/**
 * Turns a phone photo of a garment into a studio flat lay with GPT-Image-2,
 * deployed in Microsoft Foundry. The render is asked for at the highest
 * quality with high input fidelity, so what comes back is this garment — its
 * colour, its pattern, its proportions — and not a garment like it.
 */

import { Duration, Effect, Schema } from 'effect';

import { env } from '#/shared/env.ts';
import { StudioRenderError, TransparencyRefusal } from './errors/ai-errors.ts';
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
const errorBodyLimit = 500;
const transparencyTransparencyRefusal = /background|transparen/iu;

type Attempt = {
  readonly transparent: boolean;
  readonly prompt: string;
};

const attempts = (input: StudioRenderInput): ReadonlyArray<Attempt> => [
  {
    transparent: true,
    prompt: `${studioPrompt(input)} Fully transparent background.`,
  },
  {
    transparent: false,
    prompt: `${studioPrompt(input)} Seamless, plain, perfectly uniform background in the colour ${paperHex}, edge to edge, with no gradient and no vignette.`,
  },
];

const editsUrl = `${env.FOUNDRY_OPENAI_ENDPOINT.replace(/\/$/u, '')}/openai/v1/images/edits?api-version=preview`;

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

const requestEdit = (
  input: StudioRenderInput,
  attempt: Attempt,
): Effect.Effect<StudioRender, StudioRenderError | TransparencyRefusal> =>
  Effect.tryPromise({
    try: async () => {
      const form = new FormData();
      form.append('model', env.FOUNDRY_IMAGE_DEPLOYMENT);
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
      const response = await fetch(editsUrl, {
        method: 'POST',
        headers: { 'api-key': env.FOUNDRY_OPENAI_API_KEY },
        body: form,
      });
      const body = await response.text();
      if (!response.ok) {
        if (
          attempt.transparent &&
          isTransparencyRefusal(response.status, body)
        ) {
          return new TransparencyRefusal({ body });
        }
        throw new Error(
          `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
        );
      }
      const parsed = decodeEditResponse(JSON.parse(body));
      const encoded = parsed.data?.[0]?.image;
      if (encoded === undefined) {
        throw new Error('Foundry returned no image data.');
      }
      return {
        bytes: new Uint8Array(Buffer.from(encoded, 'base64')),
        mime: 'image/png' as const,
        transparent: attempt.transparent,
      };
    },
    catch: (cause) =>
      new StudioRenderError({ message: 'The studio render failed.', cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof TransparencyRefusal
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

export class StudioRenderer extends Effect.Service<StudioRenderer>()(
  'shared/StudioRenderer',
  {
    sync: () => {
      /**
       * Asks for a transparent render first. If the deployment refuses the
       * transparency parameter, asks again for the garment on the paper colour,
       * so the wardrobe still gets a studio image rather than nothing.
       */
      const render = (
        input: StudioRenderInput,
      ): Effect.Effect<StudioRender, StudioRenderError> => {
        const [transparent, opaque] = attempts(input);
        if (transparent === undefined || opaque === undefined) {
          return Effect.die('Studio render attempts are missing.');
        }
        return requestEdit(input, transparent).pipe(
          Effect.catchTag('TransparencyRefusal', () =>
            requestEdit(input, opaque).pipe(
              Effect.catchTag('TransparencyRefusal', (refusal) =>
                Effect.fail(
                  new StudioRenderError({
                    message: 'The studio render was refused.',
                    cause: refusal.body,
                  }),
                ),
              ),
            ),
          ),
        );
      };

      return { render };
    },
  },
) {}
