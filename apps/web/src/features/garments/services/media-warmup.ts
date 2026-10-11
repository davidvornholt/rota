import { Effect, ManagedRuntime } from 'effect';
import { pool } from '#/shared/db/database.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { makeCopyWarmup } from './copy-warmup.ts';

let warmup: Effect.Effect<number, never, MediaStore> | undefined;
let runtime: ManagedRuntime.ManagedRuntime<MediaStore, never> | undefined;

/**
 * The scheduled warm-up over every stored picture, of garments and of outfit
 * collages, across all wardrobes. It has its own store instance, built on
 * first use: the scheduler acts for no wardrobe, and feature runtimes are
 * built per wardrobe.
 */
export const warmMediaCopies = (): Promise<number> => {
  runtime ??= ManagedRuntime.make(MediaStore.layer);
  warmup ??= makeCopyWarmup({
    storedKeys: Effect.tryPromise(() =>
      pool.query<{ key: string }>(
        `select storage_key as key from garment_image
        union select storage_key from outfit_collage where storage_key is not null`,
      ),
    ).pipe(Effect.map((result) => result.rows.map((row) => row.key))),
    warm: (key) => Effect.flatMap(MediaStore, (media) => media.warm(key)),
  });
  return runtime.runPromise(warmup);
};
