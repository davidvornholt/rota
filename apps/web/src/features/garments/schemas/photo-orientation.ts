import { Schema } from 'effect';
import {
  ImageRotationSchema,
  imageRotations,
} from '#/shared/media/rotate-image.ts';

export const PhotoOrientationSchema = Schema.Struct({
  rotationClockwise: ImageRotationSchema,
});

export const photoOrientationProperties = {
  rotationClockwise: {
    type: 'integer',
    enum: [...imageRotations],
    description:
      'Clockwise rotation in degrees to apply to the entire source photo so the garment is upright: 0, 90, 180, or 270. Locate the neckline and shoulders of tops and dresses, or the waistband of bottoms, and put them at the top. A neckline at the bottom needs 180; at the left needs 90; at the right needs 270. Use the garment construction, not the photo dimensions or sleeve direction. Use 0 when already upright or when no clear upright direction exists.',
  },
} as const;

export const photoOrientationJsonSchema = {
  type: 'object',
  properties: photoOrientationProperties,
  required: ['rotationClockwise'],
} as const;
