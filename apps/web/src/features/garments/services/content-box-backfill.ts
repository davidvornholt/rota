/**
 * Measures where the garment sits in studio renders stored before renders
 * were measured, so the outfit collage can place them without their margins.
 * Each call handles a bounded batch; a render that cannot be measured is not
 * tried again until the process restarts. Free of configuration so it can be
 * tested alone; `media-warmup.ts` wires it to the database and the store.
 */

import { Effect } from 'effect';
import type { ContentBox } from '#/shared/media/content-box.ts';
import { measureContentBox } from '#/shared/media/content-box.ts';
import type { MediaStoreError } from '#/shared/media/errors/media-errors.ts';

/** Measuring decodes a full render, so a large wardrobe spreads over several minutes. */
const batchSize = 20;

type ContentBoxBackfillDependencies<R> = {
  readonly unmeasuredKeys: Effect.Effect<ReadonlyArray<string>, unknown, R>;
  readonly read: (
    key: string,
  ) => Effect.Effect<Uint8Array | undefined, MediaStoreError, R>;
  readonly store: (
    key: string,
    box: ContentBox,
  ) => Effect.Effect<void, unknown, R>;
};

export const makeContentBoxBackfill = <R>({
  unmeasuredKeys,
  read,
  store,
}: ContentBoxBackfillDependencies<R>): Effect.Effect<number, never, R> => {
  const unmeasurable = new Set<string>();
  let running = false;

  const measureOne = (key: string) =>
    Effect.gen(function* () {
      const bytes = yield* read(key);
      if (bytes === undefined) {
        unmeasurable.add(key);
        return;
      }
      const box = yield* measureContentBox(bytes).pipe(
        Effect.tapError(() => Effect.sync(() => unmeasurable.add(key))),
      );
      yield* store(key, box);
    }).pipe(
      Effect.catch((error) =>
        Effect.logWarning(
          'Could not measure the garment in a stored studio picture.',
          error,
        ),
      ),
    );

  /** Answers how many renders this call tried; zero while a call is still running. */
  return Effect.suspend(() => {
    if (running) {
      return Effect.succeed(0);
    }
    running = true;
    return Effect.gen(function* () {
      const keys = yield* unmeasuredKeys;
      const batch = keys
        .filter((key) => !unmeasurable.has(key))
        .slice(0, batchSize);
      for (const key of batch) {
        yield* measureOne(key);
      }
      return batch.length;
    }).pipe(
      Effect.catch((error) =>
        Effect.logWarning(
          'Could not list the studio pictures still to measure.',
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
