import {
  Anthropic,
  APIConnectionError,
  AuthenticationError,
  type ClientOptions,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { Duration, Effect, Schedule, Schema, SchemaIssue } from 'effect';
import { prepareClaudeParts } from './claude-images.ts';
import { ClaudeError } from './errors/ai-errors.ts';
import { jsonAnswer } from './json-answer.ts';

/** Every Claude request in Rota asks Claude Sonnet 5.5. */
export const claudeModel = 'claude-sonnet-5-5';

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
  readonly schema: Schema.Codec<A, I>;
  readonly jsonSchema: Record<string, unknown>;
};

export type MessageRequest =
  Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
export type MessageAnswer = Anthropic.Beta.BetaMessage;
export type CreateMessage = (
  request: MessageRequest,
  signal: AbortSignal,
) => Promise<MessageAnswer>;

const outfitRequestSeconds = 300;
const garmentRequestSeconds = 150;
const sdkTimeoutMarginSeconds = 30;
const millisecondsPerSecond = 1000;
/** The deadlines above abort the call first; the SDK's own timeout only backs them up. */
const sdkTimeoutMilliseconds =
  (outfitRequestSeconds + sdkTimeoutMarginSeconds) * millisecondsPerSecond;
const outputTokens = 16_384;
const answerExcerptEnds = 300;
const formatIssue = SchemaIssue.makeFormatterDefault();

/**
 * Effect owns the deadlines and the bounded retries, so each billed attempt has
 * its own ledger row and the SDK adds none of its own.
 */
export const claudeClient = (
  apiKey: string,
  fetch?: ClientOptions['fetch'],
): Anthropic =>
  new Anthropic({
    apiKey,
    fetch,
    maxRetries: 0,
    timeout: sdkTimeoutMilliseconds,
  });

/** A long answer keeps both ends: any reasoning comes first and the JSON usually last. */
const answerExcerpt = (text: string): string =>
  text.length <= answerExcerptEnds * 2
    ? text
    : `${text.slice(0, answerExcerptEnds)} … ${text.slice(-answerExcerptEnds)}`;

const requestFailure = (cause: unknown): ClaudeError =>
  cause instanceof AuthenticationError || cause instanceof PermissionDeniedError
    ? new ClaudeError({
        reason: 'configuration',
        message:
          "Claude rejected Rota's API key. Ask whoever runs Rota to check it.",
        cause,
      })
    : new ClaudeError({
        reason: 'request',
        message: 'The Claude request failed. Try again.',
        cause,
      });

/** Rate limits, overload, other 5xx answers and lost connections may pass on another attempt. */
const isTransient = ({ reason, cause }: ClaudeError): boolean =>
  reason === 'request' &&
  (cause instanceof RateLimitError ||
    cause instanceof InternalServerError ||
    cause instanceof APIConnectionError);

/** Why an answer stopped short, without anything the model wrote. */
const stopCause = ({ stop_reason, stop_details }: MessageAnswer): string =>
  stop_reason === 'refusal'
    ? `refusal (${stop_details?.category ?? 'uncategorized'})`
    : String(stop_reason);

/**
 * The text of the model that served the answer. After a server-side fallback,
 * a fallback block ends the declined model's output, so only text after the
 * last one counts.
 */
const servedText = (content: MessageAnswer['content']): string => {
  const served = content.reduce(
    (start, block, index) => (block.type === 'fallback' ? index + 1 : start),
    0,
  );
  return content
    .slice(served)
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
};

const messageRequest = (
  model: string,
  system: string,
  jsonSchema: Record<string, unknown>,
  parts: ReadonlyArray<PromptPart>,
): MessageRequest => ({
  model,
  max_tokens: outputTokens,
  // A request Claude Sonnet 5.5 declines as cyber or frontier-model work is
  // answered by Claude Sonnet 5 inside the same call, at the same rates.
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  // The schema goes in as instructions; every answer is validated below.
  system: [
    { type: 'text', text: system },
    {
      type: 'text',
      text: `Return only a JSON object matching this schema, without Markdown or commentary: ${JSON.stringify(jsonSchema)}`,
    },
  ],
  messages: [
    {
      role: 'user',
      content: parts.map((part) =>
        'text' in part
          ? { type: 'text', text: part.text }
          : {
              type: 'image',
              source: {
                type: 'base64',
                // prepareClaudeParts validates the MIME type before building the wire request.
                media_type: part.image.mimeType as 'image/png',
                data: Buffer.from(part.image.data).toString('base64'),
              },
            },
      ),
    },
  ],
});

export const makeGenerateJson =
  (createMessage: CreateMessage, model: string) =>
  <A, I>({
    purpose,
    system,
    parts,
    schema,
    jsonSchema,
  }: GenerateJsonInput<A, I>): Effect.Effect<A, ClaudeError> =>
    Effect.gen(function* () {
      const preparedParts = yield* prepareClaudeParts(parts);
      const request = messageRequest(model, system, jsonSchema, preparedParts);
      return yield* Effect.tryPromise({
        try: (signal) => createMessage(request, signal),
        catch: requestFailure,
      }).pipe(
        Effect.timeoutOrElse({
          duration: Duration.seconds(
            purpose === 'outfit' ? outfitRequestSeconds : garmentRequestSeconds,
          ),
          orElse: () =>
            Effect.fail(
              new ClaudeError({
                reason: 'timeout',
                message: 'The Claude request timed out. Try again.',
                cause: undefined,
              }),
            ),
        }),
        Effect.retry({
          schedule: Schedule.max([
            Schedule.exponential(Duration.seconds(2)),
            Schedule.recurs(2),
          ]),
          while: isTransient,
        }),
        Effect.flatMap((response) => {
          if (response.stop_reason !== 'end_turn') {
            return Effect.fail(
              new ClaudeError({
                reason: 'answer',
                message: 'Claude did not finish a usable answer. Try again.',
                cause: stopCause(response),
              }),
            );
          }
          const text = servedText(response.content);
          return Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
            jsonAnswer(text),
          ).pipe(
            Effect.mapError(
              (error) =>
                new ClaudeError({
                  reason: 'answer',
                  message:
                    'Claude answered outside the requested schema. Try again.',
                  // Plain strings, so the log shows what Claude said instead of a truncated issue object.
                  cause: {
                    issue: formatIssue(error.issue),
                    answer: answerExcerpt(text),
                  },
                }),
            ),
          );
        }),
      );
    });
