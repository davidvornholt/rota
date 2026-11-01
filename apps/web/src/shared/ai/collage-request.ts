import { Duration, Effect } from 'effect';
import { extensionByMime } from '#/shared/media/media-keys.ts';
import {
  CollageError,
  type StudioRateLimit,
  type StudioTransientFailure,
} from './errors/ai-errors.ts';
import {
  answerBody,
  editedImage,
  imageEditsUrl,
  lostConnection,
  retryableAnswer,
  type StudioConnection,
} from './studio-request.ts';

/** 4:5 portrait, the shape phones show a shared photo in; both edges are multiples of 16. */
export const collageSize = { width: 1088, height: 1360 } as const;

export type CollageImage = {
  readonly bytes: Uint8Array;
  readonly mime: string;
};

export type CollageInput = {
  readonly prompt: string;
  /** One picture per garment, in the order the prompt numbers them. */
  readonly images: ReadonlyArray<CollageImage>;
};

/** What every failed collage shows; the cause goes to the log. */
export const collageFailure = 'Rota could not make this picture.';

/** Sunburst took 63 to 95 seconds for three garments at high and extra-high quality. */
const requestTimeoutMinutes = 5;
const requestTimeout = Duration.minutes(requestTimeoutMinutes);
const errorBodyLimit = 500;

const failed = (cause: unknown) =>
  new CollageError({ message: collageFailure, cause });

/** One flat lay from the garment pictures, as PNG bytes. */
export const requestCollage = (
  connection: StudioConnection,
  input: CollageInput,
): Effect.Effect<
  Uint8Array,
  CollageError | StudioRateLimit | StudioTransientFailure
> =>
  Effect.tryPromise({
    try: async (signal) => {
      const form = new FormData();
      form.append('model', connection.deployment);
      form.append('prompt', input.prompt);
      for (const [index, image] of input.images.entries()) {
        form.append(
          'image[]',
          new Blob([image.bytes as BlobPart], { type: image.mime }),
          `garment-${index + 1}.${extensionByMime[image.mime] ?? 'png'}`,
        );
      }
      form.append('n', '1');
      form.append('size', `${collageSize.width}x${collageSize.height}`);
      form.append('quality', 'high');
      form.append('output_format', 'png');
      const response = await connection.request(
        imageEditsUrl(connection.endpoint),
        {
          method: 'POST',
          signal,
          headers: { 'api-key': connection.apiKey },
          body: form,
        },
      );
      const body = await answerBody(response);
      const retry = retryableAnswer(response, body, collageFailure);
      if (retry !== undefined) {
        return retry;
      }
      if (!response.ok) {
        return failed(
          `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
        );
      }
      const encoded = editedImage(body);
      return encoded === undefined
        ? failed('Foundry returned no picture.')
        : new Uint8Array(Buffer.from(encoded, 'base64'));
    },
    catch: (cause) => lostConnection(cause, collageFailure) ?? failed(cause),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof Uint8Array
        ? Effect.succeed(result)
        : Effect.fail(result),
    ),
    Effect.timeoutOrElse({
      duration: requestTimeout,
      orElse: () => Effect.fail(failed('The collage request timed out.')),
    }),
  );
