import { Effect } from 'effect';

import {
  applyPrivateResponseHeaders,
  approvePrivateResponse,
  privateResponseHeaders,
} from '#/shared/auth/private-response.ts';
import type { UploadError } from '../errors/garment-errors.ts';
import { uploadFieldName } from '../upload-contract.ts';
import { garmentsRuntime } from './garments-runtime.ts';
import { IngestService } from './ingest.ts';
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

/**
 * The photos of a multipart request, checked before any byte is stored. A
 * rejected file fails the whole request, so a batch never half-lands.
 */
const readUploads = async (
  request: Request,
): Promise<ReadonlyArray<Upload> | Response> => {
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
  return rejection === undefined
    ? uploads
    : rejected(rejection.message, rejection.httpStatus);
};

/**
 * Accepts the photos of an upload, answers as soon as each is stored, and
 * leaves the reading and rendering to run on.
 */
export const handleUpload = async (request: Request): Promise<Response> => {
  const uploads = await readUploads(request);
  if (uploads instanceof Response) {
    return uploads;
  }

  const ids = await garmentsRuntime.run(
    Effect.gen(function* () {
      const ingest = yield* IngestService;
      const started: Array<string> = [];
      for (const upload of uploads) {
        started.push(yield* ingest.start(upload));
      }
      return started;
    }),
  );

  await garmentsRuntime.run(
    Effect.gen(function* () {
      const ingest = yield* IngestService;
      for (const id of ids) {
        yield* ingest.process(id);
      }
    }),
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
  const uploads = await readUploads(request);
  if (uploads instanceof Response) {
    return uploads;
  }
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
