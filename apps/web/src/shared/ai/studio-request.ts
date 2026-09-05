import { Duration, Effect, Schema } from 'effect';
import {
  StudioRateLimit,
  StudioRenderError,
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

/** 3:4 portrait; both edges multiples of 16, as GPT-Image-2 requires. */
export const studioRenderSize = { width: 1200, height: 1600 } as const;

/** The paper colour the studio ground takes when transparency is refused. */
const paperHex = '#FAFAFB';

const requestTimeoutMinutes = 4;
const requestTimeout = Duration.minutes(requestTimeoutMinutes);
const badRequest = 400;
const tooManyRequests = 429;
const trailingSlash = /\/$/u;
const errorBodyLimit = 500;
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
};

/** The edit answer: one base64 image per requested picture, renamed off the wire. */
const EditResponse = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        image: Schema.optional(Schema.String).pipe(Schema.fromKey('b64_json')),
      }),
    ),
  ),
});
const decodeEditResponse = Schema.decodeUnknownSync(EditResponse);

const isTransparencyRefusal = (status: number, body: string): boolean =>
  status === badRequest && transparencyTransparencyRefusal.test(body);

export const requestEdit = (
  connection: StudioConnection,
  input: StudioRenderInput,
  attempt: Attempt,
): Effect.Effect<
  StudioRender,
  StudioRenderError | TransparencyRefusal | StudioRateLimit
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
      form.append('input_fidelity', 'high');
      form.append('output_format', 'png');
      if (attempt.transparent) {
        form.append('background', 'transparent');
      }
      const response = await fetch(
        `${connection.endpoint.replace(trailingSlash, '')}/openai/v1/images/edits?api-version=preview`,
        {
          method: 'POST',
          signal,
          headers: { 'api-key': connection.apiKey },
          body: form,
        },
      );
      const body = await response.text();
      if (response.status === tooManyRequests) {
        return new StudioRateLimit({
          message:
            'The image service is busy. Try the studio picture again later.',
          retryAfter: response.headers.get('retry-after-ms'),
          retryAfterSeconds: response.headers.get('retry-after'),
          cause: body.slice(0, errorBodyLimit),
        });
      }
      if (!response.ok) {
        if (
          attempt.transparent &&
          isTransparencyRefusal(response.status, body)
        ) {
          return new TransparencyRefusal({ body });
        }
        return new StudioRenderError({
          message: 'The studio picture could not be made. Try again later.',
          cause: `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
        });
      }
      const parsed = decodeEditResponse(JSON.parse(body));
      const encoded = parsed.data?.[0]?.image;
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
      new StudioRenderError({
        message: 'The studio picture could not be made. Try again later.',
        cause,
      }),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof TransparencyRefusal ||
      result instanceof StudioRateLimit ||
      result instanceof StudioRenderError
        ? Effect.fail(result)
        : Effect.succeed(result),
    ),
    Effect.timeoutFail({
      duration: requestTimeout,
      onTimeout: () =>
        new StudioRenderError({
          message: 'The studio render timed out.',
          cause: undefined,
        }),
    }),
  );
