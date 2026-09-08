import { describe, expect, it } from 'bun:test';
import { Effect, Fiber, TestClock, TestContext } from 'effect';
import type { StudioState } from '#/shared/ai/studio-progress.ts';
import { pollStudioRender } from './studio-poll.ts';

// Advancing 900 polling intervals also lets native promise callbacks settle.
const longQueueSimulationTimeoutMs = 20_000;

describe('studio polling', () => {
  it(
    'keeps polling a long queue and returns the completed render',
    async () => {
      let studioState: StudioState = { status: 'queued' };
      await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* pollStudioRender(() =>
            Promise.resolve({ studioState, studioError: null }),
          ).pipe(Effect.fork);
          yield* TestClock.adjust('30 minutes');
          expect(yield* Fiber.poll(fiber)).toMatchObject({ _tag: 'None' });
          studioState = { status: 'succeeded' };
          yield* TestClock.adjust('2 seconds');
          expect(yield* Fiber.join(fiber)).toMatchObject({ studioState });
        }).pipe(Effect.provide(TestContext.TestContext)),
      );
    },
    longQueueSimulationTimeoutMs,
  );

  it('bounds an unresponsive status request', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* pollStudioRender(
          () => new Promise<never>(() => undefined),
        ).pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('32 seconds');
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: 'Left',
          left: { _tag: 'StudioRequestError' },
        });
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });

  it('reports a persisted render failure', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* pollStudioRender(() =>
          Promise.resolve({
            studioState: { status: 'failed' } as const,
            studioError: 'The provider timed out.',
          }),
        ).pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('2 seconds');
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: 'Left',
          left: {
            message: 'The studio render failed: The provider timed out.',
          },
        });
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });
});
