import { describe, expect, it } from 'bun:test';
import { GenerateContentResponse, ThinkingLevel } from '@google/genai';
import {
  Deferred,
  Effect,
  Fiber,
  Schema,
  TestClock,
  TestContext,
} from 'effect';
import { type GenerateJsonInput, makeGenerateJson } from './gemini-request.ts';

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
const answer = (text: string) => {
  const response = new GenerateContentResponse();
  response.candidates = [{ content: { parts: [{ text }] } }];
  return response;
};

describe('Gemini outfit requests', () => {
  it('keeps HIGH reasoning and original image bytes and accepts an answer past the old timeout', async () => {
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      let finish: ((value: GenerateContentResponse) => void) | undefined;
      const generate = makeGenerateJson(
        {
          generateContent: (request) => {
            expect(request.config?.thinkingConfig?.thinkingLevel).toBe(
              ThinkingLevel.HIGH,
            );
            expect(request.config?.mediaResolution).toBeUndefined();
            expect(request.contents).toEqual([
              {
                role: 'user',
                parts: [
                  { text: 'A cool, rainy day.' },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'b3JpZ2luYWwgaW1hZ2U=',
                    },
                  },
                ],
              },
            ]);
            Effect.runSync(Deferred.succeed(started, undefined));
            return new Promise((resolve) => {
              finish = resolve;
            });
          },
        },
        'test-model',
      );
      const fiber = yield* Effect.fork(generate(input));
      yield* Deferred.await(started);
      yield* TestClock.adjust('200 seconds');
      expect((yield* Fiber.poll(fiber))._tag).toBe('None');
      finish?.(answer('{"choice":"chinos"}'));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestContext.TestContext));
    expect(await Effect.runPromise(result)).toEqual({ choice: 'chinos' });
  });

  it('aborts a stuck SDK call at the extended deadline without starting another timeout attempt', async () => {
    let calls = 0;
    let aborted = false;
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const generate = makeGenerateJson(
        {
          generateContent: (request) => {
            calls += 1;
            request.config?.abortSignal?.addEventListener('abort', () => {
              aborted = true;
            });
            Effect.runSync(Deferred.succeed(started, undefined));
            return new Promise(() => undefined);
          },
        },
        'test-model',
      );
      const fiber = yield* Effect.fork(Effect.either(generate(input)));
      yield* Deferred.await(started);
      yield* TestClock.adjust('301 seconds');
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestContext.TestContext));
    expect(await Effect.runPromise(result)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'GeminiError', reason: 'timeout' },
    });
    expect(aborted).toBeTrue();
    expect(calls).toBe(1);
  });

  it('rejects a response outside the schema without retrying it', async () => {
    let calls = 0;
    const generate = makeGenerateJson(
      {
        generateContent: () => {
          calls += 1;
          return Promise.resolve(answer('{"choice":42}'));
        },
      },
      'test-model',
    );
    expect(
      await Effect.runPromise(Effect.either(generate(input))),
    ).toMatchObject({ _tag: 'Left', left: { reason: 'answer' } });
    expect(calls).toBe(1);
  });
});
