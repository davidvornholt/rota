import { Effect, Schema } from 'effect';
import sharp from 'sharp';
import { maximumSourcePixels } from './image-limits.ts';
import type { VariantWidth } from './media-variants.ts';

export class ImageResizeError extends Schema.TaggedError<ImageResizeError>()(
  'ImageResizeError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

/** Keeps studio renders' transparent edges clean while staying a fraction of the PNG. */
const webpQuality = 80;

/**
 * Scales an image down to `width` and encodes it as WebP, keeping transparency.
 * An image already narrower keeps its size.
 */
export const resizeImage = (bytes: Uint8Array, width: VariantWidth) =>
  Effect.tryPromise({
    try: async () =>
      new Uint8Array(
        await sharp(bytes, { limitInputPixels: maximumSourcePixels })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: webpQuality })
          .toBuffer(),
      ),
    catch: (cause) =>
      new ImageResizeError({
        message: 'The image could not be resized.',
        cause,
      }),
  });
