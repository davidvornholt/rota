/**
 * Resized copies of stored images, made on first request or ahead of it, and
 * kept beside the original. Separate from the store's configuration so it can
 * be exercised with any storage.
 */

import { Effect, Either } from 'effect';
import type { MediaStoreError } from './errors/media-errors.ts';
import { mimeOfKey } from './media-keys.ts';
import {
  type VariantWidth,
  variantKey,
  variantMime,
  variantWidths,
} from './media-variants.ts';
import { resizeImage } from './resize-image.ts';

export type ServedMedia = {
  readonly bytes: Uint8Array;
  readonly mime: string;
  /**
   * False when the original stands in for a copy that could not be made; a
   * later request may get the copy, so the answer must not be cached.
   */
  readonly lasting: boolean;
};

export type CopyStorage = {
  readonly get: (
    key: string,
  ) => Effect.Effect<Uint8Array | undefined, MediaStoreError>;
  readonly has: (key: string) => Effect.Effect<boolean, MediaStoreError>;
  readonly keep: (
    key: string,
    data: Uint8Array,
  ) => Effect.Effect<void, MediaStoreError>;
};

/**
 * Each resize holds a decoded source in memory, and a first visit to a full
 * wardrobe asks for every copy at once; the rest wait their turn.
 */
const concurrentResizes = 2;

export const makeMediaCopies = ({ get, has, keep }: CopyStorage) =>
  Effect.gen(function* () {
    const resizes = yield* Effect.makeSemaphore(concurrentResizes);

    /** A copy that cannot be kept is still served; the next request makes it again. */
    const keepCopy = (key: string, data: Uint8Array) =>
      keep(key, data).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(
            'Serving a resized image without keeping it.',
            error,
          ),
        ),
      );

    /** Makes the copy from the original; an image sharp cannot read is served as it is. */
    const resize = (
      key: string,
      width: VariantWidth,
    ): Effect.Effect<ServedMedia | undefined, MediaStoreError> =>
      Effect.gen(function* () {
        const source = yield* get(key);
        if (source === undefined) {
          return;
        }
        const resized = yield* Effect.either(resizeImage(source, width));
        if (Either.isLeft(resized)) {
          yield* Effect.logWarning(
            'Serving the original because it could not be resized.',
            resized.left,
          );
          return {
            bytes: source,
            mime: mimeOfKey(key) ?? 'application/octet-stream',
            lasting: false,
          };
        }
        yield* keepCopy(variantKey(key, width), resized.right);
        return { bytes: resized.right, mime: variantMime, lasting: true };
      });

    /** The original at `width`, made and kept on first request. */
    const variant = (
      key: string,
      width: VariantWidth,
    ): Effect.Effect<ServedMedia | undefined, MediaStoreError> =>
      Effect.gen(function* () {
        const kept = yield* get(variantKey(key, width));
        if (kept !== undefined) {
          return { bytes: kept, mime: variantMime, lasting: true };
        }
        return yield* resizes.withPermits(1)(resize(key, width));
      });

    /** Makes the given copies from one read of the original; unreadable originals are skipped. */
    const makeCopies = (
      key: string,
      widths: ReadonlyArray<VariantWidth>,
    ): Effect.Effect<void, MediaStoreError> =>
      Effect.gen(function* () {
        const source = yield* get(key);
        if (source === undefined) {
          return;
        }
        for (const width of widths) {
          const resized = yield* Effect.either(resizeImage(source, width));
          if (Either.isRight(resized)) {
            yield* keepCopy(variantKey(key, width), resized.right);
          }
        }
      });

    /** Makes every missing copy of an original ahead of its first request. */
    const warm = (key: string): Effect.Effect<void, MediaStoreError> =>
      Effect.gen(function* () {
        const missing = yield* Effect.filter(variantWidths, (width) =>
          Effect.map(has(variantKey(key, width)), (present) => !present),
        );
        if (missing.length > 0) {
          yield* resizes.withPermits(1)(makeCopies(key, missing));
        }
      });

    return { variant, warm };
  });
