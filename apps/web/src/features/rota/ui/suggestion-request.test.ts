import { describe, expect, it } from 'bun:test';
import { Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { localDate } from '#/shared/time/local-date.ts';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';
import { suggestionRequest, waitForSuggestion } from './suggestion-request.ts';

const running: SuggestionJob = {
  id: 'job',
  date: localDate('2026-09-20'),
  status: 'running',
  startedAt: 0,
  message: null,
};

describe('suggestion transport', () => {
  it('recovers a dropped poll without starting generation again', async () => {
    let calls = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* waitForSuggestion(running, () => {
          calls += 1;
          return calls === 1
            ? Promise.reject(new Error('disconnected'))
            : Promise.resolve({ ...running, status: 'succeeded' });
        }).pipe(Effect.forkChild);
        yield* TestClock.adjust('4 seconds');
        expect((yield* Fiber.join(fiber)).status).toBe('succeeded');
        expect(calls).toBe(2);
      }).pipe(Effect.provide(TestClock.layer())),
    );
  });
  it('bounds and aborts unresponsive HTTP requests', async () => {
    const signals: Array<AbortSignal> = [];
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* suggestionRequest((signal) => {
          signals.push(signal);
          return new Promise<never>(() => undefined);
        }).pipe(Effect.result, Effect.forkChild);
        yield* TestClock.adjust('50 seconds');
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'SuggestionRequestError' },
        });
        const maximumAttempts = 3;
        expect(signals).toHaveLength(maximumAttempts);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
      }).pipe(Effect.provide(TestClock.layer())),
    );
  });
  it('reports terminal generation failure without more polls', async () => {
    const result = await Effect.runPromise(
      waitForSuggestion(
        {
          ...running,
          status: 'failed',
          message: 'Choosing an outfit timed out.',
        },
        () => Promise.reject(new Error('must not poll')),
      ).pipe(Effect.result),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { message: 'Choosing an outfit timed out.' },
    });
  });
});
