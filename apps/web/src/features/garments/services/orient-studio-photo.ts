import { Effect } from 'effect';
import type { Bedrock } from '#/shared/ai/bedrock.ts';
import { rotateImage, type SourcePhoto } from '#/shared/media/rotate-image.ts';
import {
  PhotoOrientationSchema,
  photoOrientationJsonSchema,
} from '../schemas/photo-orientation.ts';

/** Retries need only orientation, leaving the owner's edited attributes alone. */
export const orientStudioPhoto = (
  bedrock: Pick<Bedrock, 'generateJson'>,
  photo: SourcePhoto,
) =>
  Effect.gen(function* () {
    const orientation = yield* bedrock.generateJson({
      purpose: 'garment',
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
