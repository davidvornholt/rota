import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  Deferred,
  Effect,
  Fiber,
  type Layer,
  TestClock,
  TestContext,
} from 'effect';
import { StudioRenderError } from './errors/ai-errors.ts';
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
  instructions: 'Keep the white buttons.',
};
const success = () =>
  Response.json({
    data: [{ ...Object.fromEntries([['b64_json', 'cGljdHVyZQ==']]) }],
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
    let preparations = 0;
    const result = await run(
      Effect.gen(function* () {
        const waiting = yield* Deferred.make<void>();
        const studio = yield* makeStudioRenderer(connection);
        const job = yield* studio
          .render(
            Effect.sync(() => {
              preparations += 1;
              return input;
            }),
            (state) =>
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
    expect(preparations).toBe(1);
    expect(result.transparent).toBe(false);
    expect(new TextDecoder().decode(result.bytes)).toBe('picture');
    expect(fetchSpy).toHaveBeenCalledTimes(fallbackAndRetryCalls);
    const bodies = fetchSpy.mock.calls.map((call) => call[1]?.body);
    expect(bodies[0]).toBeInstanceOf(FormData);
    expect((bodies[0] as FormData).get('background')).toBe('transparent');
    expect((bodies[1] as FormData).has('background')).toBe(false);
    expect((bodies[2] as FormData).has('background')).toBe(false);
    for (const body of bodies) {
      expect((body as FormData).get('prompt')).toContain(input.instructions);
    }
  });

  it.each(Object.values(permanentStatuses))(
    'does not automatically resubmit an HTTP %s failure',
    async (status) => {
      fetchSpy.mockResolvedValue(new Response('rejected', { status }));
      const result = await run(
        Effect.gen(function* () {
          const studio = yield* makeStudioRenderer(connection);
          return yield* Effect.either(
            studio.render(Effect.succeed(input), () => Effect.void),
          );
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
          .render(Effect.succeed(input), (state) =>
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
          .render(Effect.succeed(input), () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('4 minutes');
        expect(yield* Fiber.join(job)).toMatchObject({
          _tag: 'Left',
          left: { message: 'The studio render timed out.' },
        });
        expect(signal?.aborted).toBe(true);
        expect(
          (yield* studio.render(Effect.succeed(input), () => Effect.void)).mime,
        ).toBe('image/png');
      }),
    );
  });
});

describe('concurrent studio fallbacks', () => {
  it("waits for the other slot's cooldown before submitting an opaque fallback", async () => {
    await run(
      Effect.gen(function* () {
        const refusal = yield* Deferred.make<Response>();
        const busy = yield* Deferred.make<void>();
        fetchSpy.mockImplementationOnce(
          Object.assign(() => Effect.runPromise(Deferred.await(refusal)), {
            preconnect: () => undefined,
          }),
        );
        fetchSpy.mockResolvedValueOnce(
          new Response('busy', {
            status: 429,
            headers: { 'retry-after-ms': '2000' },
          }),
        );
        fetchSpy.mockResolvedValueOnce(success());
        fetchSpy.mockResolvedValueOnce(success());
        const studio = yield* makeStudioRenderer(connection);
        const first = yield* studio
          .render(Effect.succeed(input), () => Effect.void)
          .pipe(Effect.fork);
        yield* TestClock.adjust('1 millis');
        const second = yield* studio
          .render(Effect.succeed(input), (state) =>
            state.status === 'waiting'
              ? Deferred.succeed(busy, undefined).pipe(Effect.asVoid)
              : Effect.void,
          )
          .pipe(Effect.fork);
        yield* Deferred.await(busy);
        yield* Deferred.succeed(
          refusal,
          new Response('transparent background unsupported', { status: 400 }),
        );
        yield* TestClock.adjust('1 second');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust('1 second');
        expect((yield* Fiber.join(first)).transparent).toBe(false);
        expect((yield* Fiber.join(second)).transparent).toBe(true);
        const initialRequestsAndRetries = 4;
        expect(fetchSpy).toHaveBeenCalledTimes(initialRequestsAndRetries);
      }),
    );
  });
});

describe('studio source preparation', () => {
  it('loads only two photos from a batch until a render frees its slot', async () => {
    await run(
      Effect.gen(function* () {
        const release = yield* Deferred.make<void>();
        fetchSpy.mockImplementation(
          Object.assign(
            () =>
              Effect.runPromise(
                Deferred.await(release).pipe(Effect.as(success())),
              ),
            { preconnect: () => undefined },
          ),
        );
        const studio = yield* makeStudioRenderer(connection);
        let preparations = 0;
        const batchSize = 10;
        const jobs = yield* Effect.forEach(
          Array.from({ length: batchSize }),
          () =>
            studio
              .render(
                Effect.sync(() => {
                  preparations += 1;
                  return input;
                }),
                () => Effect.void,
              )
              .pipe(Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        expect(preparations).toBe(2);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        yield* Deferred.succeed(release, undefined);
        yield* Effect.forEach(jobs, Fiber.join);
        expect(preparations).toBe(batchSize);
        expect(fetchSpy).toHaveBeenCalledTimes(batchSize);
      }),
    );
  });

  it('never prepares a photo that expires in the queue', async () => {
    await run(
      Effect.gen(function* () {
        const studio = yield* makeStudioRenderer(connection);
        const blockers = yield* Effect.forEach([0, 1], () =>
          studio
            .render(Effect.never, () => Effect.void)
            .pipe(Effect.either, Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        const next = yield* Effect.forEach([0, 1], () =>
          studio
            .render(Effect.never, () => Effect.void)
            .pipe(Effect.either, Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        let prepared = false;
        const queued = yield* studio
          .render(
            Effect.sync(() => {
              prepared = true;
              return input;
            }),
            () => Effect.void,
          )
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('10 minutes');
        expect(yield* Fiber.join(queued)).toMatchObject({
          _tag: 'Left',
          left: {
            message:
              'The studio picture waited too long for an image slot. Try again later.',
          },
        });
        expect(prepared).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
        yield* Effect.forEach([...blockers, ...next], Fiber.interrupt);
      }),
    );
  });
});

describe('studio preparation recovery', () => {
  it('honours a cooldown received while another photo is being prepared', async () => {
    await run(
      Effect.gen(function* () {
        const prepared = yield* Deferred.make<void>();
        const waiting = yield* Deferred.make<void>();
        fetchSpy.mockResolvedValueOnce(
          new Response('busy', {
            status: 429,
            headers: { 'retry-after-ms': '2000' },
          }),
        );
        fetchSpy.mockResolvedValueOnce(success());
        fetchSpy.mockResolvedValueOnce(success());
        const studio = yield* makeStudioRenderer(connection);
        const first = yield* studio
          .render(
            Deferred.await(prepared).pipe(Effect.as(input)),
            () => Effect.void,
          )
          .pipe(Effect.fork);
        const second = yield* studio
          .render(Effect.succeed(input), (state) =>
            state.status === 'waiting'
              ? Deferred.succeed(waiting, undefined).pipe(Effect.asVoid)
              : Effect.void,
          )
          .pipe(Effect.fork);
        yield* Deferred.await(waiting);
        yield* Deferred.succeed(prepared, undefined);
        yield* TestClock.adjust('1 second');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust('1 second');
        yield* Fiber.join(first);
        yield* Fiber.join(second);
        expect(fetchSpy).toHaveBeenCalledTimes(fallbackAndRetryCalls);
      }),
    );
  });

  it('releases a slot when preparation fails without submitting an image request', async () => {
    fetchSpy.mockResolvedValue(success());
    await run(
      Effect.gen(function* () {
        const studio = yield* makeStudioRenderer(connection);
        const failure = new StudioRenderError({
          message: 'Cannot prepare photo.',
          cause: undefined,
        });
        for (const _attempt of [0, 1]) {
          expect(
            yield* studio
              .render(Effect.fail(failure), () => Effect.void)
              .pipe(Effect.either),
          ).toMatchObject({ _tag: 'Left', left: failure });
        }
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(
          (yield* studio.render(Effect.succeed(input), () => Effect.void)).mime,
        ).toBe('image/png');
      }),
    );
  });
});
