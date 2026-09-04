/**
 * Phones hand over 10 MB photos; the models need nothing like that and the
 * upload should not either. The browser decodes, scales the long edge down,
 * and re-encodes as JPEG before a byte leaves the device.
 */

export const uploadLongEdge = 2048;
const jpegQuality = 0.88;
const fileExtension = /\.[^.]+$/u;

export class DownscaleError extends Error {
  override readonly name = 'DownscaleError';
}

const decode = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (cause) {
    throw new DownscaleError(`${file.name} could not be read as an image.`, {
      cause,
    });
  }
};

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob === null
          ? reject(new DownscaleError('The photo could not be re-encoded.'))
          : resolve(blob),
      'image/jpeg',
      jpegQuality,
    );
  });

export const downscaleForUpload = async (file: File): Promise<File> => {
  const bitmap = await decode(file);
  try {
    const scale = Math.min(
      1,
      uploadLongEdge / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new DownscaleError('The browser could not draw the photo.');
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await toBlob(canvas);
    const stem = file.name.replace(fileExtension, '') || 'garment';
    return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
};
