import { Duration, Effect, Schema } from 'effect';
import {
  ImageConnectionFailed,
  StudioRateLimit,
  StudioRenderError,
  StudioTransientFailure,
  TransparencyRefusal,
} from './errors/ai-errors.ts';
import { studioPrompt } from './studio-prompt.ts';

export type StudioRender = {
  readonly bytes: Uint8Array;
  readonly mime: 'image/png';
  readonly transparent: boolean;
};

export type StudioRenderInput = {
  readonly photo: Uint8Array;
  readonly mime: string;
  /** A short description of the garment, so the model knows what to keep. */
  readonly description: string;
  readonly instructions: string;
};

/** 3:4 portrait; both edges multiples of 16, as GPT-Image-2.5 Flare requires. */
export const studioRenderSize = { width: 1200, height: 1600 } as const;

/** The paper colour the studio ground takes when transparency is refused. */
const paperHex = '#FAFAFB';

const requestTimeoutMinutes = 4;
const requestTimeout = Duration.minutes(requestTimeoutMinutes);
const badRequest = 400;
const tooManyRequests = 429;
const internalServerError = 500;
const badGateway = 502;
const serviceUnavailable = 503;
const gatewayTimeout = 504;
/** Server failures that say nothing about the request itself, so the same request may succeed. */
const transientStatuses = new Set([
  internalServerError,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
]);
const trailingSlash = /\/$/u;
const errorBodyLimit = 500;
const studioFailure = 'The studio picture could not be made. Try again later.';
const transparencyTransparencyRefusal = /background|transparen/iu;

type Attempt = {
  readonly transparent: boolean;
  readonly prompt: string;
};

export const attempts = (input: StudioRenderInput): ReadonlyArray<Attempt> => [
  {
    transparent: true,
    prompt: `${studioPrompt(input)} Fully transparent background.`,
  },
  {
    transparent: false,
    prompt: `${studioPrompt(input)} Seamless, plain, perfectly uniform background in the colour ${paperHex}, edge to edge, with no gradient and no vignette.`,
  },
];

export type StudioConnection = {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly deployment: string;
  readonly request: (url: string, init: RequestInit) => Promise<Response>;
};

/** The edit answer: one base64 image per requested picture, renamed off the wire. */
const EditResponse = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        image: Schema.optional(Schema.String),
      }).pipe(Schema.encodeKeys({ image: 'b64_json' })),
    ),
  ),
});
const decodeEditResponse = Schema.decodeUnknownSync(EditResponse);

/** Where an edit goes: the resource root plus the v1 images path. */
export const imageEditsUrl = (endpoint: string): string =>
  `${endpoint.replace(trailingSlash, '')}/openai/v1/images/edits?api-version=preview`;

/** The first picture of an edit answer, still base64; undefined when there is none. */
export const editedImage = (body: string): string | undefined =>
  decodeEditResponse(JSON.parse(body)).data?.[0]?.image;

/**
 * Sends an image request. When the fetch fails without any answer, and not
 * because the caller aborted it, the rejection becomes `ImageConnectionFailed`.
 * The request functions retry only that, never a usage-ledger failure, which
 * can follow an answer the provider has already billed.
 */
export const sendImageRequest = (
  url: string,
  init: RequestInit,
): Promise<Response> =>
  fetch(url, init).catch((cause: unknown) => {
    throw init.signal?.aborted ? cause : new ImageConnectionFailed({ cause });
  });

/**
 * The scheduler waits and asks again after a rate limit or a transient server
 * failure, honouring the provider's retry headers; any other answer is final.
 * `message` is what the picture shows once the retries run out, and
 * `busyMessage` replaces it after a rate limit.
 */
export const retryableAnswer = (
  response: Response,
  body: string,
  message: string,
  busyMessage = message,
): StudioRateLimit | StudioTransientFailure | undefined => {
  const retry = {
    message: response.status === tooManyRequests ? busyMessage : message,
    retryAfter: response.headers.get('retry-after-ms'),
    retryAfterSeconds: response.headers.get('retry-after'),
    cause: `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
  };
  if (response.status === tooManyRequests) {
    return new StudioRateLimit(retry);
  }
  return transientStatuses.has(response.status)
    ? new StudioTransientFailure(retry)
    : undefined;
};

/** A request that never got an answer is retried like a transient server failure. */
export const lostConnection = (
  cause: unknown,
  message: string,
): StudioTransientFailure | undefined =>
  cause instanceof ImageConnectionFailed
    ? new StudioTransientFailure({
        message,
        retryAfter: null,
        retryAfterSeconds: null,
        cause: cause.cause,
      })
    : undefined;

const isTransparencyRefusal = (status: number, body: string): boolean =>
  status === badRequest && transparencyTransparencyRefusal.test(body);

export const requestEdit = (
  connection: StudioConnection,
  input: StudioRenderInput,
  attempt: Attempt,
): Effect.Effect<
  StudioRender,
  | StudioRenderError
  | TransparencyRefusal
  | StudioRateLimit
  | StudioTransientFailure
> =>
  Effect.tryPromise({
    try: async (signal) => {
      const form = new FormData();
      form.append('model', connection.deployment);
      form.append('prompt', attempt.prompt);
      form.append(
        'image',
        new Blob([input.photo as BlobPart], { type: input.mime }),
        input.mime === 'image/png' ? 'garment.png' : 'garment.jpg',
      );
      form.append('n', '1');
      form.append(
        'size',
        `${studioRenderSize.width}x${studioRenderSize.height}`,
      );
      form.append('quality', 'high');
      form.append('output_format', 'png');
      if (attempt.transparent) {
        form.append('background', 'transparent');
      }
      const response = await connection.request(
        imageEditsUrl(connection.endpoint),
        {
          method: 'POST',
          signal,
          headers: { 'api-key': connection.apiKey },
          body: form,
        },
      );
      const body = await response.text();
      const retry = retryableAnswer(
        response,
        body,
        studioFailure,
        'The image service is busy. Try the studio picture again later.',
      );
      if (retry !== undefined) {
        return retry;
      }
      if (!response.ok) {
        if (
          attempt.transparent &&
          isTransparencyRefusal(response.status, body)
        ) {
          return new TransparencyRefusal({ body });
        }
        return new StudioRenderError({
          message: studioFailure,
          cause: `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
        });
      }
      const encoded = editedImage(body);
      if (encoded === undefined) {
        return new StudioRenderError({
          message: 'The image service returned no picture. Try again.',
          cause: undefined,
        });
      }
      return {
        bytes: new Uint8Array(Buffer.from(encoded, 'base64')),
        mime: 'image/png' as const,
        transparent: attempt.transparent,
      };
    },
    catch: (cause) =>
      lostConnection(cause, studioFailure) ??
      new StudioRenderError({ message: studioFailure, cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof TransparencyRefusal ||
      result instanceof StudioRateLimit ||
      result instanceof StudioTransientFailure ||
      result instanceof StudioRenderError
        ? Effect.fail(result)
        : Effect.succeed(result),
    ),
    Effect.timeoutOrElse({
      duration: requestTimeout,
      orElse: () =>
        Effect.fail(
          new StudioRenderError({
            message: 'The studio render timed out.',
            cause: undefined,
          }),
        ),
    }),
  );
