import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { Deferred, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { collageFailure } from './collage-request.ts';
import { makeCollageRenderer } from './collage-service.ts';
import type { StudioProgress } from './studio-progress.ts';
import { sendImageRequest } from './studio-request.ts';

const transientStatuses = [500, 502, 503, 504];
const finalStatuses = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notImplemented: 501,
};
const attemptsBeforeGivingUp = 4;
// Like the Foundry connection, this one sends through `sendImageRequest`, so a dropped connection is classified the same way.
const connection = {
  endpoint: 'http://image.invalid',
  apiKey: 'fixture',
  deployment: 'fixture',
  request: sendImageRequest,
};
const input = {
  prompt: 'A flat lay of a shirt and trousers.',
  images: [{ bytes: new Uint8Array([1]), mime: 'image/png' }],
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

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

const renderThroughWait = (progress: Array<StudioProgress>) =>
  run(
    Effect.gen(function* () {
      const waiting = yield* Deferred.make<void>();
      const collages = yield* makeCollageRenderer(connection);
      const job = yield* collages
        .render(Effect.succeed(input), (state) =>
          Effect.sync(() => {
            progress.push(state);
          }).pipe(
            Effect.andThen(
              state.status === 'waiting'
                ? Deferred.succeed(waiting, undefined)
                : Effect.void,
            ),
            Effect.asVoid,
          ),
        )
        .pipe(
          // A render that ends without waiting reports its own outcome below.
          Effect.ensuring(Deferred.succeed(waiting, undefined)),
          Effect.forkChild,
        );
      yield* Deferred.await(waiting);
      const requestsBeforeRetry = fetchSpy.mock.calls.length;
      // The first backoff is two to four seconds, depending on jitter.
      yield* TestClock.adjust('4 seconds');
      return { bytes: yield* Fiber.join(job), requestsBeforeRetry };
    }),
  );

describe('collage provider failures', () => {
  it.each(transientStatuses)(
    'asks again after an HTTP %s and produces the picture',
    async (status) => {
      fetchSpy.mockResolvedValueOnce(
        new Response('upstream failed', { status }),
      );
      fetchSpy.mockResolvedValueOnce(success());
      const progress: Array<StudioProgress> = [];
      const { bytes, requestsBeforeRetry } = await renderThroughWait(progress);
      expect(new TextDecoder().decode(bytes)).toBe('picture');
      expect(requestsBeforeRetry).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(progress).toContainEqual(
        expect.objectContaining({ status: 'waiting' }),
      );
      expect(progress.at(-1)).toEqual({ status: 'rendering' });
    },
  );

  it('asks again after the connection drops before an answer', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('socket hang up'));
    fetchSpy.mockResolvedValueOnce(success());
    const { bytes, requestsBeforeRetry } = await renderThroughWait([]);
    expect(new TextDecoder().decode(bytes)).toBe('picture');
    expect(requestsBeforeRetry).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('asks again after a 503 whose body breaks off', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull: (controller) => {
            controller.error(new TypeError('socket hang up'));
          },
        }),
        { status: 503 },
      ),
    );
    fetchSpy.mockResolvedValueOnce(success());
    const { bytes } = await renderThroughWait([]);
    expect(new TextDecoder().decode(bytes)).toBe('picture');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('honours a retry hint and gives up after three retries', async () => {
    fetchSpy.mockImplementation(
      Object.assign(
        () =>
          Promise.resolve(
            new Response('unavailable', {
              status: 503,
              headers: { 'retry-after-ms': '0' },
            }),
          ),
        { preconnect: () => undefined },
      ),
    );
    const result = await run(
      Effect.gen(function* () {
        const collages = yield* makeCollageRenderer(connection);
        return yield* Effect.result(
          collages.render(Effect.succeed(input), () => Effect.void),
        );
      }),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CollageError', message: collageFailure },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(attemptsBeforeGivingUp);
  });

  it.each([
    ...Object.values(finalStatuses).map((status) => ({
      name: `HTTP ${status}`,
      answer: () => new Response('rejected', { status }),
    })),
    {
      name: 'a content-policy refusal',
      answer: () =>
        Response.json(
          { error: { code: 'content_policy_violation' } },
          { status: 400 },
        ),
    },
    {
      name: 'an answer outside the schema',
      answer: () => Response.json({ data: 'no picture' }),
    },
    { name: 'an answer without a picture', answer: () => Response.json({}) },
  ])('does not ask again after $name', async ({ answer }) => {
    fetchSpy.mockImplementation(
      Object.assign(() => Promise.resolve(answer()), {
        preconnect: () => undefined,
      }),
    );
    const result = await run(
      Effect.gen(function* () {
        const collages = yield* makeCollageRenderer(connection);
        return yield* Effect.result(
          collages.render(Effect.succeed(input), () => Effect.void),
        );
      }),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CollageError', message: collageFailure },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
