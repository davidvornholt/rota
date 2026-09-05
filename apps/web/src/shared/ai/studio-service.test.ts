import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  Deferred,
  Effect,
  Fiber,
  type Layer,
  TestClock,
  TestContext,
} from 'effect';
import { makeStudioRenderer } from './studio-service.ts';

const fallbackAndRetryCalls = 3;
const permanentStatuses = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  serverError: 500,
};
const connection = {
  endpoint: 'http://image.invalid',
  apiKey: 'fixture',
  deployment: 'fixture',
};
const input = {
  photo: new Uint8Array([1]),
  mime: 'image/png',
  description: 'A shirt',
};
const validPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const truncatedPng = 'iVBORw0KGgoAAAANSUhEUgAABAAAAAZA';
const invalidIdatPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAABElEQVQBAgMEfVvD1gAAAABJRU5ErkJggg==';
const shortScanlinePng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACUlEQVR4nGMAAAABAAFe/335AAAAAElFTkSuQmCC';
const corruptCrcPng = (() => {
  const bytes = new Uint8Array(Buffer.from(validPng, 'base64'));
  bytes.fill(0, bytes.length - 1);
  return Buffer.from(bytes).toString('base64');
})();
const success = (encoded = validPng) =>
  Response.json({
    data: [{ ...Object.fromEntries([['b64_json', encoded]]) }],
  });
const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => {
  fetchSpy.mockReset();
});

// Restore the native transport after this file so unrelated tests remain isolated.

afterAll(() => {
  fetchSpy.mockRestore();
});

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Layer.Layer.Success<typeof TestContext.TestContext>
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)));

describe('studio image requests', () => {
  it('retries 429 and retains the opaque fallback after transparency is refused', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('transparent background is unsupported', { status: 400 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response('busy', {
        status: 429,
        headers: { 'retry-after-ms': '2000' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(success());
    const result = await run(
      Effect.gen(function* () {
        const waiting = yield* Deferred.make<void>();
        const studio = yield* makeStudioRenderer(connection);
        const job = yield* studio
          .render(input, (state) =>
            state.status === 'waiting'
              ? Deferred.succeed(waiting, undefined).pipe(Effect.asVoid)
              : Effect.void,
          )
          .pipe(Effect.fork);
        yield* Deferred.await(waiting);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust('2 seconds');
        return yield* Fiber.join(job);
      }),
    );
    expect(result.transparent).toBe(false);
    expect(result.bytes).toEqual(
      new Uint8Array(Buffer.from(validPng, 'base64')),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(fallbackAndRetryCalls);
    const bodies = fetchSpy.mock.calls.map((call) => call[1]?.body);
    expect(bodies[0]).toBeInstanceOf(FormData);
    expect((bodies[0] as FormData).get('background')).toBe('transparent');
    expect((bodies[1] as FormData).has('background')).toBe(false);
    expect((bodies[2] as FormData).has('background')).toBe(false);
  });

  it.each(Object.values(permanentStatuses))(
    'does not automatically resubmit an HTTP %s failure',
    async (status) => {
      fetchSpy.mockResolvedValue(new Response('rejected', { status }));
      const result = await run(
        Effect.gen(function* () {
          const studio = yield* makeStudioRenderer(connection);
          return yield* Effect.either(studio.render(input, () => Effect.void));
        }),
      );
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { _tag: 'StudioRenderError' },
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    '',
    '!!!',
    'bm90LWltYWdl',
    truncatedPng,
    invalidIdatPng,
    shortScanlinePng,
    corruptCrcPng,
  ])(
    'rejects an empty or malformed base64 image response: %s',
    async (encoded) => {
      fetchSpy.mockResolvedValueOnce(success(encoded));
      const result = await run(
        Effect.gen(function* () {
          const studio = yield* makeStudioRenderer(connection);
          return yield* Effect.either(studio.render(input, () => Effect.void));
        }),
      );
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { _tag: 'StudioRenderError' },
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );
});

describe('studio deadlines', () => {
  it('ends an excessive provider wait at the overall deadline without retrying early', async () => {
    fetchSpy.mockResolvedValue(
      new Response('busy', { status: 429, headers: { 'Retry-After': '3600' } }),
    );
    const result = await run(
      Effect.gen(function* () {
        const waiting = yield* Deferred.make<void>();
        const studio = yield* makeStudioRenderer(connection);
        const job = yield* studio
          .render(input, (state) =>
            state.status === 'waiting'
              ? Deferred.succeed(waiting, undefined).pipe(Effect.asVoid)
              : Effect.void,
          )
          .pipe(Effect.either, Effect.fork);
        yield* Deferred.await(waiting);
        yield* TestClock.adjust('10 minutes');
        return yield* Fiber.join(job);
      }),
    );
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { message: 'The studio picture took too long. Try again later.' },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts a timed-out fetch and releases the deployment permit', async () => {
    let signal: AbortSignal | null | undefined;
    fetchSpy.mockImplementationOnce(
      Object.assign(
        (_url: RequestInfo | URL, options?: RequestInit) => {
          signal = options?.signal;
          return new Promise<Response>((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new Error('Aborted'));
            });
          });
        },
        { preconnect: () => undefined },
      ),
    );
    fetchSpy.mockResolvedValueOnce(success());
    await run(
      Effect.gen(function* () {
        const studio = yield* makeStudioRenderer(connection);
        const job = yield* studio
          .render(input, () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('4 minutes');
        expect(yield* Fiber.join(job)).toMatchObject({
          _tag: 'Left',
          left: { message: 'The studio render timed out.' },
        });
        expect(signal?.aborted).toBe(true);
        expect((yield* studio.render(input, () => Effect.void)).mime).toBe(
          'image/png',
        );
      }),
    );
  });
});
