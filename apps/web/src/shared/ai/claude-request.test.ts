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
  },
};
const reasonedAnswer =
  'The neckline of this shirt is at the left side of the image, with the hem at the right. The schema says a neckline at the left needs a 90° clockwise rotation, so the garment becomes upright after turning it a quarter turn.\n\n{"rotationClockwise":90}';
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
  it.each([
    ['reasoning before the JSON', reasonedAnswer],
    [
      'a complete JSON answer containing a Markdown fence',
      '{"rotationClockwise":90,"description":"```null```"}',
    ],
    ['a fenced json block', '```json\n{"rotationClockwise":90}\n```'],
    [
      'a stray brace before the JSON',
      'The collar {or the placket sits at the left.\n\n{"rotationClockwise":90}',
    ],
  ])('reads the JSON from %s', async (_case, value) => {
    expect(await orient(value)).toMatchObject({
      _tag: 'Success',
      success: { rotationClockwise: 90 },
    });
  });

  it.each([
    ['prose with no JSON', 'The neckline is at the left, so turn it 90°.'],
    ['a bare array', '[{"rotationClockwise":90}]'],
    [
      'an array following prose',
      'Here is the answer: [{"rotationClockwise":90}]',
    ],
    [
      'a fenced array following prose',
      '```json\nHere is the answer: [{"rotationClockwise":90}]\n```',
    ],
    [
      'a truncated enclosing object',
      'Final answer: {"rotationClockwise":45,"example":{"rotationClockwise":90}',
    ],
    ['a truncated enclosing array', 'Final answer: [{"rotationClockwise":90}'],
    [
      'JSON with a value outside the schema',
      'The garment is slightly tilted.\n\n{"rotationClockwise":45}',
    ],
  ])('rejects %s', async (_case, value) => {
    expect(await orient(value)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ClaudeError', reason: 'answer' },
    });
  });

  it('keeps the answer text and the formatted issue when decoding fails', async () => {
    const value = 'The garment is slightly tilted.\n\n{"rotationClockwise":45}';
    expect(await orient(value)).toMatchObject({
      _tag: 'Failure',
      failure: {
        message: 'Claude answered outside the requested schema. Try again.',
        cause: {
          issue: expect.stringContaining('rotationClockwise'),
          answer: value,
        },
      },
    });
  });

  it('keeps both ends of a long answer in the failure cause', async () => {
    const reasoning = 'The neckline is hard to see. '.repeat(40);
    const value = `${reasoning}{"rotationClockwise":45}`;
    expect(await orient(value)).toMatchObject({
      _tag: 'Failure',
      failure: {
        cause: {
          answer: `${value.slice(0, 300)} … ${value.slice(-300)}`,
        },
      },
    });
  });
});

describe('Claude answer endings', () => {
  it('reads only the answer that follows a server-side fallback', async () => {
    const generate = makeGenerateJson(
      () =>
        Promise.resolve(
          message([
            text('The answer is {"choice":'),
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
