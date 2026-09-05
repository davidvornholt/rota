import { Effect } from 'effect';

import {
  applyPrivateResponseHeaders,
  approvePrivateResponse,
  privateResponseHeaders,
} from '#/shared/auth/private-response.ts';
import type { UploadError } from '../errors/garment-errors.ts';
import { uploadFieldName } from '../upload-contract.ts';
import { garmentsRuntime } from './garments-runtime.ts';
import { IngestService, validateUpload } from './ingest.ts';

/** 202: the photos are stored; the reading continues after the answer. */
const accepted = 202;

const jsonResponse = (body: unknown, status: number): Response => {
  const headers = new Headers({ 'content-type': 'application/json' });
  applyPrivateResponseHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
};

/**
 * Accepts the photos of an upload, answers as soon as each is stored, and
 * leaves the reading and rendering to run on. A rejected file fails the whole
 * request before anything is stored, so a batch never half-lands.
 */
export const handleUpload = async (request: Request): Promise<Response> => {
  const form = await request.formData().catch(() => undefined);
  const files = form
    ?.getAll(uploadFieldName)
    .filter((entry): entry is File => entry instanceof File);
  if (files === undefined || files.length === 0) {
    return approvePrivateResponse(
      new Response('No photos were included.', {
        status: 400,
        headers: privateResponseHeaders,
      }),
    );
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
    return approvePrivateResponse(
      new Response(rejection.message, {
        status: rejection.httpStatus,
        headers: privateResponseHeaders,
      }),
    );
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
