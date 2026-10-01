import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ImageFormat,
} from '@aws-sdk/client-bedrock-runtime';
import { Duration, Effect, Schedule, Schema } from 'effect';
import { prepareBedrockParts } from './bedrock-images.ts';
import { BedrockError } from './errors/ai-errors.ts';

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

export type Converse = (
  request: ConverseCommandInput,
  signal: AbortSignal,
) => Promise<ConverseCommandOutput>;

const outfitRequestSeconds = 300;
const garmentRequestSeconds = 150;
const outputTokens = 16_384;
const tooManyRequests = 429;
const internalServerError = 500;
const badGateway = 502;
const serviceUnavailable = 503;
const gatewayTimeout = 504;
const transientStatuses = new Set([
  tooManyRequests,
  internalServerError,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
]);
const isTransient = (error: BedrockError): boolean => {
  const { cause } = error;
  if (cause === null || typeof cause !== 'object' || !('$metadata' in cause)) {
    return false;
  }
  const metadata = cause.$metadata as { httpStatusCode?: number };
  return transientStatuses.has(metadata.httpStatusCode ?? 0);
};
export const makeGenerateJson =
  (converse: Converse, model: string) =>
  <A, I>({
    purpose,
    system,
    parts,
    schema,
    jsonSchema,
  }: GenerateJsonInput<A, I>): Effect.Effect<A, BedrockError> =>
    Effect.gen(function* () {
      const preparedParts = yield* prepareBedrockParts(parts);
      return yield* Effect.tryPromise({
        try: (signal) =>
          converse(
            {
              modelId: model,
              // Sonnet 5.5 on runtime rejects constrained output and forced tools.
              // Supply the schema as instructions and validate every answer below.
              system: [
                { text: system },
                {
                  text: `Return only a JSON object matching this schema, without Markdown or commentary: ${JSON.stringify(jsonSchema)}`,
                },
              ],
              messages: [
                {
                  role: 'user',
                  content: preparedParts.map((part) =>
                    'text' in part
                      ? { text: part.text }
                      : {
                          image: {
                            // prepareBedrockParts validates the MIME type before building the wire request.
                            format: part.image.mimeType.replace(
                              'image/',
                              '',
                            ) as ImageFormat,
                            source: { bytes: part.image.data },
                          },
                        },
                  ),
                },
              ],
              inferenceConfig: { maxTokens: outputTokens },
              additionalModelRequestFields: {
                thinking: { type: 'adaptive' },
                // biome-ignore lint/style/useNamingConvention: Anthropic's Bedrock wire field.
                output_config: { effort: 'high' },
              },
            },
            signal,
          ),
        catch: (cause) =>
          new BedrockError({
            reason: 'request',
            message: 'The Bedrock request failed. Try again.',
            cause,
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: Duration.seconds(
            purpose === 'outfit' ? outfitRequestSeconds : garmentRequestSeconds,
          ),
          onTimeout: () =>
            new BedrockError({
              reason: 'timeout',
              message: 'The Bedrock request timed out. Try again.',
              cause: undefined,
            }),
        }),
        Effect.retry({
          schedule: Schedule.intersect(
            Schedule.exponential(Duration.seconds(2)),
            Schedule.recurs(2),
          ),
          while: isTransient,
        }),
        Effect.flatMap((response) => {
          if (response.stopReason !== 'end_turn') {
            return Effect.fail(
              new BedrockError({
                reason: 'answer',
                message: 'Claude did not finish a usable answer. Try again.',
                cause: response.stopReason,
              }),
            );
          }
          const text =
            response.output?.message?.content
              ?.flatMap((block) =>
                block.text === undefined ? [] : [block.text],
              )
              .join('') ?? '';
          return Schema.decodeUnknown(Schema.parseJson(schema))(text).pipe(
            Effect.mapError(
              (cause) =>
                new BedrockError({
                  reason: 'answer',
                  message:
                    'Claude answered outside the requested schema. Try again.',
                  cause,
                }),
            ),
          );
        }),
      );
    });
