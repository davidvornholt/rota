import { Effect, ManagedRuntime } from 'effect';
import { pool } from '#/shared/db/database.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { makeContentBoxBackfill } from './content-box-backfill.ts';
import { makeCopyWarmup } from './copy-warmup.ts';

let warmup: Effect.Effect<number, never, MediaStore> | undefined;
let backfill: Effect.Effect<number, never, MediaStore> | undefined;
let runtime: ManagedRuntime.ManagedRuntime<MediaStore, never> | undefined;

/**
 * The scheduled warm-up over every stored picture, across all wardrobes. It
 * has its own store instance, built on first use: the scheduler acts for no
 * wardrobe, and feature runtimes are built per wardrobe.
 */
export const warmMediaCopies = (): Promise<number> => {
  runtime ??= ManagedRuntime.make(MediaStore.layer);
  warmup ??= makeCopyWarmup({
    storedKeys: Effect.tryPromise(() =>
      pool.query<{ key: string }>(
        'select distinct storage_key as key from garment_image',
      ),
    ).pipe(Effect.map((result) => result.rows.map((row) => row.key))),
    warm: (key) => Effect.flatMap(MediaStore, (media) => media.warm(key)),
  });
  return runtime.runPromise(warmup);
};

/** The scheduled measurement of studio renders stored before renders were measured. */
export const measureStudioRenders = (): Promise<number> => {
  runtime ??= ManagedRuntime.make(MediaStore.layer);
  backfill ??= makeContentBoxBackfill({
    unmeasuredKeys: Effect.tryPromise(() =>
      pool.query<{ key: string }>(
        `select distinct storage_key as key from garment_image
         where kind = 'studio' and content_box is null`,
      ),
    ).pipe(Effect.map((result) => result.rows.map((row) => row.key))),
    read: (key) => Effect.flatMap(MediaStore, (media) => media.get(key)),
    store: (key, box) =>
      Effect.tryPromise(() =>
        pool.query(
          `update garment_image set content_box = $1::jsonb
           where storage_key = $2 and kind = 'studio' and content_box is null`,
          [JSON.stringify(box), key],
        ),
      ),
  });
  return runtime.runPromise(backfill);
};
