import { APIError } from '@anthropic-ai/sdk';
import { Schema } from 'effect';
import {
  claudeModel,
  type GenerateJsonInput,
  type MessageAnswer,
} from './claude-request.ts';

/** A made-up outfit request with one text part and one image part. */
export const input: GenerateJsonInput<{ choice: string }, { choice: string }> =
  {
    purpose: 'outfit',
    system: 'Choose an outfit.',
    parts: [
      { text: 'A cool, rainy day.' },
      {
        image: {
          mimeType: 'image/png',
          data: new TextEncoder().encode('original image'),
        },
      },
    ],
    schema: Schema.Struct({ choice: Schema.String }),
    jsonSchema: {
      type: 'object',
      properties: { choice: { type: 'string' } },
      required: ['choice'],
    },
  };

export const text = (value: string) => ({
  type: 'text' as const,
  text: value,
  citations: null,
});

export const message = (
  content: MessageAnswer['content'],
  stop: Pick<MessageAnswer, 'stop_reason' | 'stop_details'> = {
    stop_reason: 'end_turn',
    stop_details: null,
  },
): MessageAnswer => ({
  id: 'msg_fixture',
  type: 'message',
  role: 'assistant',
  model: claudeModel,
  container: null,
  context_management: null,
  diagnostics: null,
  stop_sequence: null,
  usage: {
    input_tokens: 1,
    output_tokens: 1,
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    fallback_credit: null,
    inference_geo: null,
    iterations: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: 'standard',
    speed: null,
  },
  content,
  ...stop,
});

/** A finished answer whose text follows a thinking block, as adaptive thinking returns it. */
export const answer = (value: string): MessageAnswer =>
  message([
    { type: 'thinking', thinking: '', signature: 'fixture' },
    text(value),
  ]);

/** The SDK error class the SDK itself raises for this status. */
export const apiError = (
  status: number,
  type: string,
  apiMessage = 'Made-up failure.',
) =>
  APIError.generate(
    status,
    { type: 'error', error: { type, message: apiMessage } },
    undefined,
    new Headers(),
  );
