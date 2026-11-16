import { describe, expect, it } from 'bun:test';
import { Effect, Schema } from 'effect';
import {
  type ImageRotation,
  ImageRotationSchema,
  imageRotations,
} from '#/shared/media/rotate-image.ts';
import {
  claudeModel,
  type GenerateJsonInput,
  makeGenerateJson,
} from './claude-request.ts';
import { answer, input, message, text } from './claude-request-test-support.ts';

const orientation: GenerateJsonInput<
  { rotationClockwise: ImageRotation },
  { rotationClockwise: ImageRotation }
> = {
  purpose: 'garment',
  system: 'Identify the upright orientation of a garment in a wardrobe photo.',
  parts: [{ text: 'Report the rotation needed to make this garment upright.' }],
  schema: Schema.Struct({ rotationClockwise: ImageRotationSchema }),
  jsonSchema: {
    type: 'object',
    properties: {
      rotationClockwise: { type: 'integer', enum: [...imageRotations] },
    },
    required: ['rotationClockwise'],
    additionalProperties: false,
  },
};
const orient = (value: string) =>
  Effect.runPromise(
    Effect.result(
      makeGenerateJson(
        () => Promise.resolve(answer(value)),
        claudeModel,
      )(orientation),
    ),
  );

describe('Claude answer JSON', () => {
  it('reads a JSON answer', async () => {
    expect(await orient('{"rotationClockwise":90}')).toMatchObject({
      _tag: 'Success',
      success: { rotationClockwise: 90 },
    });
  });

  // The API constrains a finished answer to the JSON Schema, so anything else
  // means that guarantee failed, and Rota rejects it rather than guess.
  it.each([
    ['reasoning before the JSON', 'Turn it.\n\n{"rotationClockwise":90}'],
    ['a fenced json block', '```json\n{"rotationClockwise":90}\n```'],
    ['prose with no JSON', 'The neckline is at the left, so turn it 90°.'],
    ['a bare array', '[{"rotationClockwise":90}]'],
    ['a truncated object', '{"rotationClockwise":90'],
    ['JSON with a value outside the schema', '{"rotationClockwise":45}'],
  ])('rejects %s', async (_case, value) => {
    expect(await orient(value)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ClaudeError', reason: 'answer' },
    });
  });
});

describe('Claude answer endings', () => {
  it('reads only the answer that follows a server-side fallback', async () => {
    const generate = makeGenerateJson(
      () =>
        Promise.resolve(
          message([
            text('{"choice":'),
            {
              type: 'fallback',
              from: { model: claudeModel },
              to: { model: 'claude-sonnet-5' },
              trigger: { type: 'refusal', category: 'cyber' },
            },
            text('{"choice":"chinos"}'),
          ]),
        ),
      claudeModel,
    );
    expect(await Effect.runPromise(generate(input))).toEqual({
      choice: 'chinos',
    });
  });

  it.each([
    ['max_tokens', null, 'max_tokens'],
    [
      'refusal',
      {
        type: 'refusal',
        category: 'general_harms',
        explanation: null,
        fallback_credit_token: null,
        fallback_has_prefill_claim: null,
        recommended_model: null,
      },
      'refusal (general_harms)',
    ],
    ['refusal', null, 'refusal (uncategorized)'],
  ] as const)(
    'rejects a %s stop even when its JSON matches',
    async (stopReason, details, cause) => {
      let calls = 0;
      const generate = makeGenerateJson(() => {
        calls += 1;
        return Promise.resolve(
          message([text('{"choice":"chinos"}')], {
            stop_reason: stopReason,
            stop_details: details,
          }),
        );
      }, claudeModel);
      expect(
        await Effect.runPromise(Effect.result(generate(input))),
      ).toMatchObject({
        _tag: 'Failure',
        failure: {
          reason: 'answer',
          message: 'Claude did not finish a usable answer. Try again.',
          cause,
        },
      });
      expect(calls).toBe(1);
    },
  );
});
