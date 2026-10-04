/**
 * Makes the smaller copies of stored garment pictures ahead of their first
 * view, so a picture never waits for a resize. Each call handles a bounded
 * batch, and an original whose copies are known to exist is not checked again
 * until the process restarts. Free of configuration so it can be tested alone;
 * `media-warmup.ts` wires it to the database and the store.
 */

import { Effect } from 'effect';
import type { MediaStoreError } from '#/shared/media/errors/media-errors.ts';

/** A large wardrobe spreads over several minutes instead of one long tick. */
const batchSize = 20;

type CopyWarmupDependencies<R> = {
  readonly storedKeys: Effect.Effect<ReadonlyArray<string>, unknown, R>;
  readonly warm: (key: string) => Effect.Effect<void, MediaStoreError, R>;
};

export const makeCopyWarmup = <R>({
  storedKeys,
  warm,
}: CopyWarmupDependencies<R>): Effect.Effect<number, never, R> => {
  const ready = new Set<string>();
  let running = false;

  /** Answers how many originals this call checked; zero while a call is still running. */
  return Effect.suspend(() => {
    if (running) {
      return Effect.succeed(0);
    }
    running = true;
    return Effect.gen(function* () {
      const keys = yield* storedKeys;
      const batch = keys.filter((key) => !ready.has(key)).slice(0, batchSize);
      for (const key of batch) {
        yield* warm(key).pipe(
          Effect.tap(() => Effect.sync(() => ready.add(key))),
          Effect.catch((error) =>
            Effect.logWarning(
              'Could not prepare smaller copies of a stored picture.',
              error,
            ),
          ),
        );
      }
      return batch.length;
    }).pipe(
      Effect.catch((error) =>
        Effect.logWarning(
          'Could not list stored pictures to prepare copies.',
          error,
        ).pipe(Effect.as(0)),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          running = false;
        }),
      ),
    );
  });
};
