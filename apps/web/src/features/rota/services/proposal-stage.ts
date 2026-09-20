import { Clock, Effect, Exit } from 'effect';

/** Operational timings deliberately exclude wardrobe contents and provider payloads. */
export const proposalStage = <A, E, R>(
  stage: 'context' | 'images' | 'model' | 'persist',
  work: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis;
    return yield* work.pipe(
      Effect.onExit((exit) =>
        Effect.gen(function* () {
          const finished = yield* Clock.currentTimeMillis;
          yield* Effect.logInfo('Outfit suggestion stage completed.').pipe(
            Effect.annotateLogs({
              stage,
              durationMs: finished - started,
              outcome: Exit.isSuccess(exit) ? 'success' : 'failure',
            }),
          );
        }),
      ),
    );
  });
