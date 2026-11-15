/** The multipart field the browser puts photos in and the server reads them from. */
export const uploadFieldName = 'photo';
/**
 * The multipart field that names each photo, in the order of the photo fields.
 * The browser makes the id when it first picks a photo and sends it again on a
 * retry, so a retry after a lost answer finds the garment the first try opened.
 */
export const uploadIdFieldName = 'uploadId';
const uploadIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const isUploadId = (value: string): boolean =>
  uploadIdPattern.test(value);
export const uploadEndpoint = '/api/garments/upload';
export const replacePhotoEndpoint = (garmentId: string) =>
  `/api/garments/${encodeURIComponent(garmentId)}/photo`;
