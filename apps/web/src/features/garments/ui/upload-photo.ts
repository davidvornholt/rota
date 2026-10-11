import { Effect, Schema } from 'effect';

import { uploadEndpoint, uploadFieldName } from '../upload-contract.ts';
import { DownscaleError, downscaleForUpload } from './downscale-image.ts';

/** Why a photo did not reach the wardrobe, and whether sending it again can help. */
export class PhotoUploadError extends Schema.TaggedError<PhotoUploadError>()(
  'PhotoUploadError',
  { message: Schema.String, retryable: Schema.Boolean },
) {}

/** One photo in, one garment opened. */
const UploadAnswer = Schema.fromJsonString(
  Schema.Struct({ ids: Schema.Tuple([Schema.String]) }),
);

const firstServerError = 500;

const prepare = (file: File) =>
  Effect.tryPromise({
    try: () => downscaleForUpload(file),
    catch: (cause) =>
      new PhotoUploadError({
        message:
          cause instanceof DownscaleError
            ? cause.message
            : `${file.name} could not be read as an image.`,
        retryable: false,
      }),
  });

const unreachable = new PhotoUploadError({
  message: 'The photo could not be sent. Check the connection and try again.',
  retryable: true,
});

const signedOut = new PhotoUploadError({
  message:
    'You were signed out, so the photo was not added. Sign in again, then add it.',
  retryable: false,
});

/** The server explains a refusal in plain text; a proxy's error page does not. */
const refusal = (response: Response) =>
  Effect.promise(() => response.text().catch(() => '')).pipe(
    Effect.map(
      (text) =>
        new PhotoUploadError({
          message:
            text !== '' &&
            (response.headers.get('content-type') ?? '').startsWith(
              'text/plain',
            )
              ? text
              : `The photo was not added (${response.status}).`,
          retryable: response.status >= firstServerError,
        }),
    ),
  );

/**
 * Shrinks one photo on the device and sends it on its own, so one bad photo
 * never holds back the rest. Answers with the id of the garment it opened.
 */
export const uploadPhoto = Effect.fnUntraced(function* (file: File) {
  const prepared = yield* prepare(file);
  const form = new FormData();
  form.append(uploadFieldName, prepared, prepared.name);
  const response = yield* Effect.tryPromise({
    try: () => fetch(uploadEndpoint, { method: 'POST', body: form }),
    catch: () => unreachable,
  });
  // The upload route sends a signed-out request to the sign-in page.
  if (response.redirected) {
    return yield* signedOut;
  }
  if (!response.ok) {
    return yield* yield* refusal(response);
  }
  const answer = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: () => unreachable,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(UploadAnswer)),
    Effect.mapError(
      () =>
        new PhotoUploadError({
          // Sending again would add the garment twice.
          message:
            'The photo was sent, but the answer could not be read. Refresh the page to see it.',
          retryable: false,
        }),
    ),
  );
  return answer.ids[0];
});
