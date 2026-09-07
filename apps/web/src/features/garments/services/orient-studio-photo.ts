import { Effect } from 'effect';
import type { Gemini } from '#/shared/ai/gemini.ts';
import { rotateImage, type SourcePhoto } from '#/shared/media/rotate-image.ts';
import {
  PhotoOrientationSchema,
  photoOrientationJsonSchema,
} from '../schemas/photo-orientation.ts';

/** Retries need only orientation, leaving the owner's edited attributes alone. */
export const orientStudioPhoto = (
  gemini: Pick<Gemini, 'generateJson'>,
  photo: SourcePhoto,
) =>
  Effect.gen(function* () {
    const orientation = yield* gemini.generateJson({
      system:
        'Identify the upright orientation of a garment in a wardrobe photo.',
      parts: [
        { image: { mimeType: photo.mime, data: photo.bytes } },
        { text: 'Report the rotation needed to make this garment upright.' },
      ],
      schema: PhotoOrientationSchema,
      jsonSchema: photoOrientationJsonSchema,
    });
    return yield* rotateImage(photo, orientation.rotationClockwise);
  });
