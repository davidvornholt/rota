import { Effect } from 'effect';

import {
  applyPrivateResponseHeaders,
  approvePrivateResponse,
  privateResponseHeaders,
} from '#/shared/auth/private-response.ts';
import type { UploadError } from '../errors/garment-errors.ts';
import {
  isUploadId,
  uploadFieldName,
  uploadIdFieldName,
} from '../upload-contract.ts';
import { garmentsRuntime } from './garments-runtime.ts';
import { IngestService } from './ingest.ts';
import { openGarments } from './open-garments.ts';
import { type Upload, validateUpload } from './photo-upload.ts';

/** 202: the photos are stored; the reading continues after the answer. */
const accepted = 202;
const ok = 200;
const badRequest = 400;

const jsonResponse = (body: unknown, status: number): Response => {
  const headers = new Headers({ 'content-type': 'application/json' });
  applyPrivateResponseHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
};

const rejected = (message: string, status: number): Response =>
  approvePrivateResponse(
    new Response(message, { status, headers: privateResponseHeaders }),
  );

type Uploads = {
  readonly uploads: ReadonlyArray<Upload>;
  /** One id per photo, in the same order; empty when the request carried none. */
  readonly uploadIds: ReadonlyArray<string>;
};

/**
 * The photos of a multipart request, checked before any byte is stored. A
 * rejected file fails the whole request, so a batch never half-lands.
 */
const readUploads = async (request: Request): Promise<Uploads | Response> => {
  const form = await request.formData().catch(() => undefined);
  const files = form
    ?.getAll(uploadFieldName)
    .filter((entry): entry is File => entry instanceof File);
  if (files === undefined || files.length === 0) {
    return rejected('No photos were included.', badRequest);
  }
  const uploads = await Promise.all(
    files.map(async (file) => ({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
    })),
  );
  const rejection = uploads
    .map(validateUpload)
    .find((error): error is UploadError => error !== undefined);
  if (rejection !== undefined) {
    return rejected(rejection.message, rejection.httpStatus);
  }
  const uploadIds = (form?.getAll(uploadIdFieldName) ?? []).filter(
    (entry): entry is string => typeof entry === 'string',
  );
  return { uploads, uploadIds };
};

/**
 * Accepts the photos of an upload, answers as soon as each is stored, and
 * leaves the reading and rendering to run on. A photo whose upload id opened a
 * garment before, because the answer to the first try was lost, answers with
 * that garment instead of opening a second one.
 */
export const handleUpload = async (request: Request): Promise<Response> => {
  const read = await readUploads(request);
  if (read instanceof Response) {
    return read;
  }
  const { uploads, uploadIds } = read;
  if (uploadIds.length !== uploads.length || !uploadIds.every(isUploadId)) {
    return rejected(
      'This upload is not from the current app. Reload the app and try again.',
      badRequest,
    );
  }

  const ids = await garmentsRuntime.run(
    Effect.flatMap(IngestService, (ingest) =>
      openGarments(
        ingest,
        uploads.map((upload, index) => ({
          upload,
          uploadId: uploadIds[index] ?? '',
        })),
      ),
    ),
  );
  return jsonResponse({ ids }, accepted);
};

/**
 * Swaps the photo of one garment for the single photo in the request. The
 * garment keeps its reading; a missing garment or a render in progress leaves
 * as the typed failure's status through the authenticated boundary.
 */
export const handleReplacePhoto = async (
  request: Request,
  garmentId: string,
): Promise<Response> => {
  const read = await readUploads(request);
  if (read instanceof Response) {
    return read;
  }
  const { uploads } = read;
  const [upload] = uploads;
  if (upload === undefined || uploads.length !== 1) {
    return rejected('Send exactly one photo.', badRequest);
  }
  await garmentsRuntime.run(
    Effect.flatMap(IngestService, (ingest) =>
      ingest.replacePhoto(garmentId, upload),
    ),
  );
  return jsonResponse({ id: garmentId }, ok);
};
