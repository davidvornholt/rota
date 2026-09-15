import { garmentFn } from '../services/garments-fns.ts';
import { replacePhotoEndpoint, uploadFieldName } from '../upload-contract.ts';
import { downscaleForUpload } from './downscale-image.ts';

/**
 * Shrinks the picked photo on the device, swaps it in for the garment's
 * photo, and hands back the garment as the server now shows it.
 */
export const replacePhoto = async ({
  id,
  file,
}: {
  readonly id: string;
  readonly file: File;
}) => {
  const prepared = await downscaleForUpload(file);
  const form = new FormData();
  form.append(uploadFieldName, prepared, prepared.name);
  const response = await fetch(replacePhotoEndpoint(id), {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message === ''
        ? `The photo could not be replaced (${response.status}).`
        : message,
    );
  }
  return garmentFn({ data: { id } });
};
