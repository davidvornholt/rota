import { Data, Effect, Schema } from 'effect';
import sharp from 'sharp';

const quarterTurn = 90;
const halfTurn = 180;
const threeQuarterTurn = 270;
export const imageRotations = [
  0,
  quarterTurn,
  halfTurn,
  threeQuarterTurn,
] as const;
export const ImageRotationSchema = Schema.Literal(...imageRotations);
export type ImageRotation = Schema.Schema.Type<typeof ImageRotationSchema>;

export type SourcePhoto = {
  readonly bytes: Uint8Array;
  readonly mime: string;
};

export class ImageRotationError extends Data.TaggedError('ImageRotationError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/** Uploads already have EXIF orientation baked into their pixels by the browser. */
export const rotateImage = (photo: SourcePhoto, clockwise: ImageRotation) =>
  clockwise === 0
    ? Effect.succeed(photo)
    : Effect.tryPromise({
        try: async () => ({
          bytes: new Uint8Array(
            await sharp(photo.bytes).rotate(clockwise).png().toBuffer(),
          ),
          mime: 'image/png',
        }),
        catch: (cause) =>
          new ImageRotationError({
            message:
              'The garment photo could not be rotated. Try another photo.',
            cause,
          }),
      });
