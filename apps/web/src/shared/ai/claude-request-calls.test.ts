import { describe, expect, it } from 'bun:test';
import { APIConnectionError, OverloadedError } from '@anthropic-ai/sdk';
import { Deferred, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import {
  type CreateMessage,
  claudeClient,
  claudeModel,
  type MessageAnswer,
  makeGenerateJson,
} from './claude-request.ts';
import { answer, apiError, input } from './claude-request-test-support.ts';

describe('Claude wire requests', () => {
  it('sends adaptive high-effort thinking, the fallback beta and the original image bytes', async () => {
    const requests: Array<{ url: URL; headers: Headers; body: unknown }> = [];
    const client = claudeClient('made-up-key', (url, init) => {
      requests.push({
        url: new URL(String(url)),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return Promise.resolve(Response.json(answer('{"choice":"chinos"}')));
    });
    const generate = makeGenerateJson(
      (request, signal) => client.beta.messages.create(request, { signal }),
      claudeModel,
    );
    expect(await Effect.runPromise(generate(input))).toEqual({
      choice: 'chinos',
    });
    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.url.pathname).toBe('/v1/messages');
    expect(sent?.headers.get('authorization')).toBe('Bearer made-up-key');
    expect(sent?.headers.get('anthropic-beta')).toBe(
      'server-side-fallback-2026-07-01',
    );
    expect(sent?.body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 16_384,
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: [
        { type: 'text', text: 'Choose an outfit.' },
        {
          type: 'text',
          text: expect.stringContaining(JSON.stringify(input.jsonSchema)),
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'A cool, rainy day.' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: Buffer.from('original image').toString('base64'),
              },
            },
          ],
        },
      ],
    });
  });

  it('leaves retries to Effect: the SDK makes a single attempt', async () => {
    let calls = 0;
    const client = claudeClient('made-up-key', () => {
      calls += 1;
      return Promise.resolve(
        Response.json(
          { type: 'error', error: { type: 'overloaded_error', message: '' } },
          { status: 529 },
        ),
      );
    });
    const failure = await client.beta.messages
      .create({
        model: claudeModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Made-up question.' }],
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(OverloadedError);
    expect(calls).toBe(1);
  });
});

describe('Claude request deadlines', () => {
  it('accepts an outfit answer that takes longer than a garment request may', async () => {
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      let finish: ((value: MessageAnswer) => void) | undefined;
      const generate = makeGenerateJson((_request, signal) => {
        expect(signal.aborted).toBeFalse();
        Effect.runSync(Deferred.succeed(started, undefined));
        return new Promise((resolve) => {
          finish = resolve;
        });
      }, claudeModel);
      const fiber = yield* Effect.forkChild(generate(input));
      yield* Deferred.await(started);
      yield* TestClock.adjust('200 seconds');
      expect(fiber.pollUnsafe()).toBeUndefined();
      finish?.(answer('{"choice":"chinos"}'));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()));
    expect(await Effect.runPromise(result)).toEqual({ choice: 'chinos' });
  });

  it('aborts a stuck call at the deadline without starting another attempt', async () => {
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
      }, claudeModel);
      const fiber = yield* Effect.forkChild(Effect.result(generate(input)));
      yield* Deferred.await(started);
      yield* TestClock.adjust('301 seconds');
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()));
    expect(await Effect.runPromise(result)).toMatchObject({
      _tag: 'Failure',
      failure: {
        _tag: 'ClaudeError',
        reason: 'timeout',
        message: 'The Claude request timed out. Try again.',
      },
    });
    expect(aborted).toBeTrue();
    expect(calls).toBe(1);
  });
});

describe('Claude request retries', () => {
  it.each([
    ['a rate limit', () => apiError(429, 'rate_limit_error')],
    ['an overload', () => apiError(529, 'overloaded_error')],
    ['a server error', () => apiError(500, 'api_error')],
    ['a lost connection', () => new APIConnectionError({})],
  ])('retries after %s', async (_case, failure) => {
    let calls = 0;
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const generate = makeGenerateJson(() => {
        calls += 1;
        if (calls === 1) {
          Effect.runSync(Deferred.succeed(started, undefined));
          return Promise.reject(failure());
        }
        return Promise.resolve(answer('{"choice":"chinos"}'));
      }, claudeModel);
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

  it('gives up after three attempts', async () => {
    let calls = 0;
    const result = Effect.gen(function* () {
      const started = [
        yield* Deferred.make<void>(),
        yield* Deferred.make<void>(),
        yield* Deferred.make<void>(),
      ] as const;
      const generate = makeGenerateJson(() => {
        const call = started[calls];
        calls += 1;
        if (call) {
          Effect.runSync(Deferred.succeed(call, undefined));
        }
        return Promise.reject(apiError(529, 'overloaded_error'));
      }, claudeModel);
      const fiber = yield* Effect.forkChild(Effect.result(generate(input)));
      yield* Deferred.await(started[0]);
      yield* TestClock.adjust('2 seconds');
      yield* Deferred.await(started[1]);
      yield* TestClock.adjust('4 seconds');
      yield* Deferred.await(started[2]);
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()));
    expect(await Effect.runPromise(result)).toMatchObject({
      _tag: 'Failure',
      failure: {
        reason: 'request',
        message: 'The Claude request failed. Try again.',
      },
    });
    expect(calls).toBe(3);
  });
});

describe('Claude request failures', () => {
  it('rejects a response outside the schema without retrying it', async () => {
    let calls = 0;
    const generate = makeGenerateJson(() => {
      calls += 1;
      return Promise.resolve(answer('{"choice":42}'));
    }, claudeModel);
    expect(
      await Effect.runPromise(Effect.result(generate(input))),
    ).toMatchObject({ _tag: 'Failure', failure: { reason: 'answer' } });
    expect(calls).toBe(1);
  });

  it.each([
    [401, 'authentication_error', 'configuration'],
    [403, 'permission_error', 'configuration'],
    [400, 'invalid_request_error', 'request'],
    [402, 'billing_error', 'request'],
    [408, 'timeout_error', 'request'],
    [413, 'request_too_large', 'request'],
  ] as const)('does not retry a %i answer', async (status, type, reason) => {
    let calls = 0;
    const generate = makeGenerateJson(() => {
      calls += 1;
      return Promise.reject(apiError(status, type));
    }, claudeModel);
    expect(
      await Effect.runPromise(Effect.result(generate(input))),
    ).toMatchObject({ _tag: 'Failure', failure: { reason } });
    expect(calls).toBe(1);
  });

  it('tells whoever runs Rota to check a rejected API key', async () => {
    const generate: CreateMessage = () =>
      Promise.reject(apiError(401, 'authentication_error'));
    expect(
      await Effect.runPromise(
        Effect.result(makeGenerateJson(generate, claudeModel)(input)),
      ),
    ).toMatchObject({
      _tag: 'Failure',
      failure: {
        reason: 'configuration',
        message:
          "Claude rejected Rota's API key. Ask whoever runs Rota to check it.",
      },
    });
  });
});
