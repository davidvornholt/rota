import { type GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Duration, Effect, Schedule, Schema } from 'effect';
import { GeminiError } from './errors/ai-errors.ts';

export type ImagePart = {
  readonly mimeType: string;
  readonly data: Uint8Array;
};

/** A prompt is text and images interleaved, in the order the model should read them. */
export type PromptPart =
  | { readonly text: string }
  | { readonly image: ImagePart };

export type GenerateJsonInput<A, I> = {
  readonly purpose: 'outfit' | 'garment';
  readonly system: string;
  readonly parts: ReadonlyArray<PromptPart>;
  readonly schema: Schema.Schema<A, I>;
  readonly jsonSchema: Record<string, unknown>;
};

const outfitRequestSeconds = 300;
const garmentRequestSeconds = 150;

const transientStatusPattern = /\b(?<status>429|500|502|503|504)\b/u;

const isTransient = (error: GeminiError): boolean =>
  error.cause instanceof Error &&
  transientStatusPattern.test(error.cause.message);

const toBase64 = (data: Uint8Array): string =>
  Buffer.from(data).toString('base64');

export const makeGenerateJson =
  (models: Pick<GoogleGenAI['models'], 'generateContent'>, model: string) =>
  <A, I>({
    purpose,
    system,
    parts,
    schema,
    jsonSchema,
  }: GenerateJsonInput<A, I>): Effect.Effect<A, GeminiError> => {
    const outfit = purpose === 'outfit';
    const requestTimeout = Duration.seconds(
      outfit ? outfitRequestSeconds : garmentRequestSeconds,
    );
    const retrySchedule = Schedule.intersect(
      Schedule.exponential(Duration.seconds(2)),
      Schedule.recurs(2),
    );
    return Effect.tryPromise({
      try: (signal) =>
        models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: parts.map((part) =>
                'text' in part
                  ? { text: part.text }
                  : {
                      inlineData: {
                        mimeType: part.image.mimeType,
                        data: toBase64(part.image.data),
                      },
                    },
              ),
            },
          ],
          config: {
            abortSignal: signal,
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        }),
      catch: (cause) =>
        new GeminiError({
          reason: 'request',
          message: 'The Gemini request failed.',
          cause,
        }),
    }).pipe(
      Effect.timeoutFail({
        duration: requestTimeout,
        onTimeout: () =>
          new GeminiError({
            reason: 'timeout',
            message: 'The Gemini request timed out.',
            cause: undefined,
          }),
      }),
      Effect.retry({
        schedule: retrySchedule,
        while: isTransient,
      }),
      Effect.flatMap((response) =>
        Schema.decodeUnknown(Schema.parseJson(schema))(
          response.text ?? '',
        ).pipe(
          Effect.mapError(
            (cause) =>
              new GeminiError({
                reason: 'answer',
                message: 'Gemini answered outside the requested schema.',
                cause,
              }),
          ),
        ),
      ),
    );
  };
