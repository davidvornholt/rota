/**
 * What happens to a photo between the request and the garment row: checked,
 * stored, attached. Nothing here reads configuration, so the upload route can
 * validate before the runtime is involved and the logic is testable alone.
 */

import { Effect } from 'effect';
import type {
  GarmentRepository,
  StoredImage,
} from '#/shared/data/garment-repository.ts';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import { maximumSourcePixels } from '#/shared/media/image-limits.ts';
import { isStorableMime } from '#/shared/media/media-keys.ts';
import type { MediaStore } from '#/shared/media/media-store.ts';
import { UploadError } from '../errors/garment-errors.ts';

export type Upload = {
  readonly bytes: Uint8Array;
  readonly mime: string;
};

/** Photos are downscaled in the browser before upload; anything larger did not come from the app. */
const bytesPerKibibyte = 1024;
const bytesPerMebibyte = bytesPerKibibyte * bytesPerKibibyte;
const uploadLimitMebibytes = 6;
export const maximumUploadBytes = uploadLimitMebibytes * bytesPerMebibyte;
const tooLargePhoto = new UploadError({
  message:
    'That photo is too large. Photos are resized in the app before upload; try again from the app.',
  httpStatus: 413,
});

const unreadablePhoto = new UploadError({
  message: 'That file is not a readable JPEG or PNG photo.',
  httpStatus: 400,
});

/** Everything that can be wrong with an upload before any byte is stored. */
export const validateUpload = (upload: Upload): UploadError | undefined => {
  if (!isStorableMime(upload.mime)) {
    return new UploadError({
      message: 'Only JPEG, PNG, and WebP photos can be added.',
      httpStatus: 400,
    });
  }
  if (upload.bytes.byteLength > maximumUploadBytes) {
    return tooLargePhoto;
  }
  const dimensions = imageDimensions(upload.bytes);
  if (dimensions === undefined) {
    return unreadablePhoto;
  }
  return dimensions.width * dimensions.height > maximumSourcePixels
    ? tooLargePhoto
    : undefined;
};

export const storeUpload = (
  { media }: { readonly media: Pick<MediaStore, 'put'> },
  upload: Upload,
) =>
  Effect.gen(function* () {
    const rejection = validateUpload(upload);
    if (rejection !== undefined) {
      return yield* rejection;
    }
    const dimensions = imageDimensions(upload.bytes);
    if (dimensions === undefined) {
      return yield* unreadablePhoto;
    }
    const stored = yield* media.put(upload.bytes, upload.mime);
    const image: StoredImage = {
      key: stored.key,
      mime: upload.mime,
      width: dimensions.width,
      height: dimensions.height,
      bytes: stored.bytes,
    };
    return image;
  });

type ReplacePhotoDependencies = {
  readonly garments: Pick<
    GarmentRepository,
    'byId' | 'attachImage' | 'setImageChoice'
  >;
  readonly media: Pick<MediaStore, 'put'>;
};

/**
 * A new photo for a garment that is already read: the picture changes, the
 * attributes stay. The new photo is shown at once; a studio picture from the
 * old photo stays until the wearer renders again.
 */
export const replaceOriginalPhoto = (
  deps: ReplacePhotoDependencies,
  rendering: boolean,
  id: string,
  upload: Upload,
) =>
  Effect.gen(function* () {
    yield* deps.garments.byId(id);
    if (rendering) {
      return yield* new UploadError({
        message:
          'A studio picture is in progress. Wait for it to finish before replacing the photo.',
        httpStatus: 409,
      });
    }
    const image = yield* storeUpload(deps, upload);
    yield* deps.garments.attachImage(id, 'original', image);
    yield* deps.garments.setImageChoice(id, 'original');
  });
