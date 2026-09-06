import { describe, expect, it } from 'bun:test';
import {
  Clock,
  Duration,
  Effect,
  Fiber,
  type Layer,
  TestClock,
  TestContext,
} from 'effect';
import { StudioRateLimit, StudioRenderError } from './errors/ai-errors.ts';
import type { StudioProgress } from './studio-progress.ts';
import { makeStudioScheduler, retryDelay } from './studio-scheduler.ts';

const limited = (milliseconds: string | null, seconds: string | null = null) =>
  new StudioRateLimit({
    message: 'Busy. Try again later.',
    retryAfter: milliseconds,
    retryAfterSeconds: seconds,
    cause: undefined,
  });
const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Layer.Layer.Success<typeof TestContext.TestContext>
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)));

const expectedAttempts = 4;
const firstBackoffMinimum = 2000;
const firstBackoffMaximum = 4000;
const nextJobTime = 4000;
const maximumCooldown = Duration.toMillis(Duration.minutes(10));
const now = Date.parse('2026-09-05T12:00:00Z');

describe('studio rate limits', () => {
  it.each([
    { milliseconds: '1500', seconds: '9', expected: 1500 },
    { milliseconds: null, seconds: '2', expected: 2000 },
    {
      milliseconds: null,
      seconds: 'Sat, 05 Sep 2026 12:00:03 GMT',
      expected: 3000,
    },
    {
      milliseconds: null,
      seconds: 'Sat, 05 Sep 2026 11:00:00 GMT',
      expected: 0,
    },
    { milliseconds: 'invalid', seconds: '4', expected: 4000 },
    { milliseconds: '-1', seconds: null, expected: undefined },
    { milliseconds: null, seconds: '-1', expected: undefined },
    {
      milliseconds: '999999999999999',
      seconds: null,
      expected: maximumCooldown,
    },
    {
      milliseconds: null,
      seconds: 'Sat, 01 Jan 2050 00:00:00 GMT',
      expected: maximumCooldown,
    },
    { milliseconds: '', seconds: '', expected: undefined },
    { milliseconds: null, seconds: null, expected: undefined },
  ])(
    'interprets provider delays $milliseconds / $seconds',
    ({ milliseconds, seconds, expected }) => {
      expect(retryDelay(limited(milliseconds, seconds), now)).toBe(expected);
    },
  );

  it('waits for the provider delay, then succeeds', async () => {
    const progress: Array<StudioProgress> = [];
    let calls = 0;
    const value = await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const request = Effect.suspend(() => {
          calls += 1;
          return calls === 1
            ? Effect.fail(limited('2000'))
            : Effect.succeed('picture');
        });
        const fiber = yield* scheduler
          .schedule(request, (state) =>
            Effect.sync(() => {
              progress.push(state);
            }),
          )
          .pipe(Effect.fork);
        yield* TestClock.adjust('1999 millis');
        expect(calls).toBe(1);
        expect(progress.at(-1)).toEqual({ status: 'waiting', retryAt: 2000 });
        yield* TestClock.adjust('1 millis');
        return yield* Fiber.join(fiber);
      }),
    );
    expect(value).toBe('picture');
    expect(calls).toBe(2);
    expect(progress.at(-1)).toEqual({ status: 'rendering' });
  });

  it('stops after four attempts and shares the remaining cooldown with the next job', async () => {
    let calls = 0;
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const request = Effect.suspend(() => {
          calls += 1;
          return Effect.fail(limited('1000'));
        });
        const first = yield* scheduler
          .schedule(request, () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('3 seconds');
        const result = yield* Fiber.join(first);
        expect(result._tag).toBe('Left');
        expect(calls).toBe(expectedAttempts);
        const second = yield* scheduler
          .schedule(Clock.currentTimeMillis, () => Effect.void)
          .pipe(Effect.fork);
        yield* TestClock.adjust('1 second');
        expect(yield* Fiber.join(second)).toBe(nextJobTime);
      }),
    );
  });

  it('bounds a far-future provider cooldown before the next job runs', async () => {
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        let calls = 0;
        const request = Effect.suspend(() => {
          calls += 1;
          return calls === 1
            ? Effect.fail(limited(null, 'Sat, 01 Jan 2050 00:00:00 GMT'))
            : Effect.succeed('picture');
        });
        const first = yield* scheduler
          .schedule(request, () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust(Duration.millis(maximumCooldown));
        expect(yield* Fiber.join(first)).toMatchObject({
          _tag: 'Left',
          left: {
            message: 'The studio picture took too long. Try again later.',
          },
        });
        expect(
          yield* scheduler.schedule(Clock.currentTimeMillis, () => Effect.void),
        ).toBe(maximumCooldown);
      }),
    );
  });
});

describe('studio scheduling', () => {
  it('runs at most two jobs and releases the permit after interruption', async () => {
    let inFlight = 0;
    let peak = 0;
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const request = Effect.acquireUseRelease(
          Effect.sync(() => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
          }),
          () => Effect.sleep('1 second'),
          () =>
            Effect.sync(() => {
              inFlight -= 1;
            }),
        );
        const blocked = yield* scheduler
          .schedule(Effect.never, () => Effect.void)
          .pipe(Effect.fork);
        yield* TestClock.adjust('1 millis');
        const jobs = yield* Effect.all(
          [request, request, request].map((work) =>
            scheduler.schedule(work, () => Effect.void),
          ),
          { concurrency: 'unbounded' },
        ).pipe(Effect.fork);
        yield* Fiber.interrupt(blocked);
        yield* TestClock.adjust('2 seconds');
        yield* Fiber.join(jobs);
      }),
    );
    expect(peak).toBe(2);
    expect(inFlight).toBe(0);
  });

  it('uses jittered backoff without a usable header and does not retry permanent errors', async () => {
    const times: Array<number> = [];
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const request = Effect.gen(function* () {
          times.push(yield* Clock.currentTimeMillis);
          return yield* Effect.fail(limited(null));
        });
        const job = yield* scheduler
          .schedule(request, () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('60 seconds');
        yield* Fiber.join(job);
        expect(times).toHaveLength(expectedAttempts);
        expect(times[1]).toBeGreaterThanOrEqual(firstBackoffMinimum);
        expect(times[1]).toBeLessThanOrEqual(firstBackoffMaximum);
        const failed = new StudioRenderError({
          message: 'Rejected',
          cause: undefined,
        });
        const permanent = yield* scheduler
          .schedule(Effect.fail(failed), () => Effect.void)
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('60 seconds');
        expect(yield* Fiber.join(permanent)).toMatchObject({
          _tag: 'Left',
          left: failed,
        });
      }),
    );
  });
});
