/**
 * The one door to Gemini. Every call asks for JSON against a schema, decodes
 * the answer with the matching Effect Schema, and runs at HIGH thinking: the
 * two things the model decides for Rota — what a garment is, and what to wear —
 * are worth the extra seconds, and a morning proposal is computed before you
 * are awake anyway.
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Duration, Effect, Schedule, Schema } from 'effect';

import { env } from '#/shared/env.ts';
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
  readonly system: string;
  readonly parts: ReadonlyArray<PromptPart>;
  readonly schema: Schema.Schema<A, I>;
  readonly jsonSchema: Record<string, unknown>;
};

const requestTimeoutSeconds = 150;
const requestTimeout = Duration.seconds(requestTimeoutSeconds);
const retrySchedule = Schedule.intersect(
  Schedule.exponential(Duration.seconds(2)),
  Schedule.recurs(2),
);

const transientStatusPattern = /\b(?<status>429|500|502|503|504)\b/u;

const isTransient = (error: GeminiError): boolean =>
  error.cause instanceof Error &&
  transientStatusPattern.test(error.cause.message);

const toBase64 = (data: Uint8Array): string =>
  Buffer.from(data).toString('base64');

export class Gemini extends Effect.Service<Gemini>()('shared/Gemini', {
  sync: () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: env.GOOGLE_VERTEX_PROJECT,
      location: env.GOOGLE_VERTEX_LOCATION,
      googleAuthOptions: {
        credentials: JSON.parse(env.GOOGLE_VERTEX_CREDENTIALS_JSON) as Record<
          string,
          unknown
        >,
      },
    });
    const model = env.GEMINI_MODEL;

    const generateJson = <A, I>({
      system,
      parts,
      schema,
      jsonSchema,
    }: GenerateJsonInput<A, I>): Effect.Effect<A, GeminiError> =>
      Effect.tryPromise({
        try: async () => {
          const response = await client.models.generateContent({
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
              systemInstruction: system,
              responseMimeType: 'application/json',
              responseJsonSchema: jsonSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            },
          });
          const { text } = response;
          if (text === undefined || text === '') {
            throw new Error('Gemini returned no text.');
          }
          return JSON.parse(text) as unknown;
        },
        catch: (cause) =>
          new GeminiError({ message: 'The Gemini request failed.', cause }),
      }).pipe(
        Effect.timeoutFail({
          duration: requestTimeout,
          onTimeout: () =>
            new GeminiError({
              message: 'The Gemini request timed out.',
              cause: undefined,
            }),
        }),
        Effect.retry({ schedule: retrySchedule, while: isTransient }),
        Effect.flatMap((json) =>
          Schema.decodeUnknown(schema)(json).pipe(
            Effect.mapError(
              (cause) =>
                new GeminiError({
                  message: 'Gemini answered outside the requested schema.',
                  cause,
                }),
            ),
          ),
        ),
      );

    return { generateJson, model };
  },
}) {}
