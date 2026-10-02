/**
 * Resized copies of stored images, made on first request and kept beside the
 * original. Separate from the store's configuration so it can be exercised with
 * any storage.
 */

import { Effect, Either } from 'effect';
import type { MediaStoreError } from './errors/media-errors.ts';
import { mimeOfKey } from './media-keys.ts';
import {
  type VariantWidth,
  variantKey,
  variantMime,
} from './media-variants.ts';
import { resizeImage } from './resize-image.ts';

export type ServedMedia = {
  readonly bytes: Uint8Array;
  readonly mime: string;
};

export type CopyStorage = {
  readonly get: (
    key: string,
  ) => Effect.Effect<Uint8Array | undefined, MediaStoreError>;
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

export const makeMediaCopies = ({ get, keep }: CopyStorage) =>
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
          };
        }
        yield* keepCopy(variantKey(key, width), resized.right);
        return { bytes: resized.right, mime: variantMime };
      });

    /** The original at `width`, made and kept on first request. */
    return (
      key: string,
      width: VariantWidth,
    ): Effect.Effect<ServedMedia | undefined, MediaStoreError> =>
      Effect.gen(function* () {
        const kept = yield* get(variantKey(key, width));
        if (kept !== undefined) {
          return { bytes: kept, mime: variantMime };
        }
        return yield* resizes.withPermits(1)(resize(key, width));
      });
  });
