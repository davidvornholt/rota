import { describe, expect, it } from 'bun:test';
import {
  AccessDeniedException,
  type ConverseCommandOutput,
  ThrottlingException,
} from '@aws-sdk/client-bedrock-runtime';
import { Deferred, Effect, Fiber, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import {
  type ImageRotation,
  ImageRotationSchema,
  imageRotations,
} from '#/shared/media/rotate-image.ts';
import { type GenerateJsonInput, makeGenerateJson } from './bedrock-request.ts';

const input: GenerateJsonInput<{ choice: string }, { choice: string }> = {
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
const answer = (text: string): ConverseCommandOutput => ({
  $metadata: {},
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  metrics: { latencyMs: 1 },
  stopReason: 'end_turn',
  output: {
    message: {
      role: 'assistant',
      content: [
        {
          reasoningContent: {
            reasoningText: { text: 'thinking', signature: 'fixture' },
          },
        },
        { text },
      ],
    },
  },
});

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
const orient = (text: string) =>
  Effect.runPromise(
    Effect.result(
      makeGenerateJson(
        () => Promise.resolve(answer(text)),
        'test-model',
      )(orientation),
    ),
  );

describe('Bedrock answers', () => {
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
  ])('reads the JSON from %s', async (_case, text) => {
    expect(await orient(text)).toMatchObject({
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
  ])('rejects %s', async (_case, text) => {
    expect(await orient(text)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'BedrockError', reason: 'answer' },
    });
  });

  it('keeps the answer text and the formatted issue when decoding fails', async () => {
    const text = 'The garment is slightly tilted.\n\n{"rotationClockwise":45}';
    expect(await orient(text)).toMatchObject({
      _tag: 'Failure',
      failure: {
        message: 'Claude answered outside the requested schema. Try again.',
        cause: {
          issue: expect.stringContaining('rotationClockwise'),
          answer: text,
        },
      },
    });
  });

  it('keeps both ends of a long answer in the failure cause', async () => {
    const reasoning = 'The neckline is hard to see. '.repeat(40);
    const text = `${reasoning}{"rotationClockwise":45}`;
    expect(await orient(text)).toMatchObject({
      _tag: 'Failure',
      failure: {
        cause: {
          answer: `${text.slice(0, 300)} … ${text.slice(-300)}`,
        },
      },
    });
  });
});

describe('Bedrock outfit requests', () => {
  it('keeps HIGH reasoning and original image bytes and accepts an answer past the old timeout', async () => {
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      let finish: ((value: ConverseCommandOutput) => void) | undefined;
      const generate = makeGenerateJson((request, signal) => {
        expect(request.modelId).toBe('test-model');
        expect(request.additionalModelRequestFields).toEqual({
          thinking: { type: 'adaptive' },
          // biome-ignore lint/style/useNamingConvention: Anthropic's Bedrock wire field.
          output_config: { effort: 'high' },
        });
        expect(request.toolConfig).toBeUndefined();
        expect(request.system?.[1]).toEqual({
          text: expect.stringContaining(JSON.stringify(input.jsonSchema)),
        });
        expect(request.messages).toEqual([
          {
            role: 'user',
            content: [
              { text: 'A cool, rainy day.' },
              {
                image: {
                  format: 'png',
                  source: {
                    bytes: new TextEncoder().encode('original image'),
                  },
                },
              },
            ],
          },
        ]);
        expect(signal.aborted).toBeFalse();
        Effect.runSync(Deferred.succeed(started, undefined));
        return new Promise((resolve) => {
          finish = resolve;
        });
      }, 'test-model');
      const fiber = yield* Effect.forkChild(generate(input));
      yield* Deferred.await(started);
      yield* TestClock.adjust('200 seconds');
      expect(fiber.pollUnsafe()).toBeUndefined();
      finish?.(answer('{"choice":"chinos"}'));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()));
    expect(await Effect.runPromise(result)).toEqual({ choice: 'chinos' });
  });

  it('aborts a stuck SDK call at the extended deadline without starting another timeout attempt', async () => {
    let calls = 0;
    let aborted = false;
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const generate = makeGenerateJson((_request, signal) => {
        calls += 1;
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        Effect.runSync(Deferred.succeed(started, undefined));
        return new Promise(() => undefined);
      }, 'test-model');
      const fiber = yield* Effect.forkChild(Effect.result(generate(input)));
      yield* Deferred.await(started);
      yield* TestClock.adjust('301 seconds');
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()));
    expect(await Effect.runPromise(result)).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'BedrockError', reason: 'timeout' },
    });
    expect(aborted).toBeTrue();
    expect(calls).toBe(1);
  });

  it('rejects a response outside the schema without retrying it', async () => {
    let calls = 0;
    const generate = makeGenerateJson(() => {
      calls += 1;
      return Promise.resolve(answer('{"choice":42}'));
    }, 'test-model');
    expect(
      await Effect.runPromise(Effect.result(generate(input))),
    ).toMatchObject({ _tag: 'Failure', failure: { reason: 'answer' } });
    expect(calls).toBe(1);
  });
});

it.each(['max_tokens', 'guardrail_intervened'] as const)(
  'rejects %s even when its JSON matches',
  async (stopReason) => {
    let calls = 0;
    const generate = makeGenerateJson(() => {
      calls += 1;
      return Promise.resolve({ ...answer('{"choice":"chinos"}'), stopReason });
    }, 'test-model');
    expect(
      await Effect.runPromise(Effect.result(generate(input))),
    ).toMatchObject({ _tag: 'Failure', failure: { reason: 'answer' } });
    expect(calls).toBe(1);
  },
);

it('retries a throttled Bedrock attempt and keeps high effort for garment requests', async () => {
  let calls = 0;
  const result = Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    const generate = makeGenerateJson((request) => {
      calls += 1;
      expect(request.additionalModelRequestFields).toMatchObject({
        // biome-ignore lint/style/useNamingConvention: Anthropic's Bedrock wire field.
        output_config: { effort: 'high' },
      });
      if (calls === 1) {
        Effect.runSync(Deferred.succeed(started, undefined));
        return Promise.reject(
          new ThrottlingException({
            message: 'Too many requests.',
            $metadata: { httpStatusCode: 429 },
          }),
        );
      }
      return Promise.resolve(answer('{"choice":"chinos"}'));
    }, 'test-model');
    const fiber = yield* Effect.forkChild(
      generate({ ...input, purpose: 'garment' }),
    );
    yield* Deferred.await(started);
    yield* TestClock.adjust('3 seconds');
    return yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestClock.layer()));
  expect(await Effect.runPromise(result)).toEqual({ choice: 'chinos' });
  expect(calls).toBe(2);
});

it('does not retry an access denial', async () => {
  let calls = 0;
  const generate = makeGenerateJson(() => {
    calls += 1;
    return Promise.reject(
      new AccessDeniedException({
        message: 'Access denied.',
        $metadata: { httpStatusCode: 403 },
      }),
    );
  }, 'test-model');
  expect(await Effect.runPromise(Effect.result(generate(input)))).toMatchObject(
    { _tag: 'Failure', failure: { reason: 'request' } },
  );
  expect(calls).toBe(1);
});
