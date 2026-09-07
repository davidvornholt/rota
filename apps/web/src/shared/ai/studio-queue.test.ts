import { describe, expect, it } from 'bun:test';
import {
  Clock,
  Effect,
  Fiber,
  type Layer,
  TestClock,
  TestContext,
} from 'effect';
import { StudioRateLimit } from './errors/ai-errors.ts';
import { makeStudioScheduler } from './studio-scheduler.ts';

const twoSlots = [0, 1];
const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Layer.Layer.Success<typeof TestContext.TestContext>
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)));

describe('studio queue budgets', () => {
  it('gives a queued job its full rendering budget after acquiring a slot', async () => {
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const blockers = yield* Effect.forEach(twoSlots, () =>
          scheduler
            .schedule(Effect.sleep('9 minutes'), () => Effect.void)
            .pipe(Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        let started = false;
        const queued = yield* scheduler
          .schedule(
            Effect.sync(() => {
              started = true;
            }).pipe(
              Effect.andThen(Effect.sleep('9 minutes')),
              Effect.as('picture'),
            ),
            () => Effect.void,
          )
          .pipe(Effect.fork);
        yield* TestClock.adjust('8 minutes');
        expect(started).toBe(false);
        yield* TestClock.adjust('10 minutes');
        expect(yield* Fiber.join(queued)).toBe('picture');
        yield* Effect.forEach(blockers, Fiber.join);
      }),
    );
  });

  it('expires a long queue wait without starting the request or leaking a slot', async () => {
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        const blockers = yield* Effect.forEach(twoSlots, () =>
          scheduler
            .schedule(Effect.sleep('9 minutes'), () => Effect.void)
            .pipe(Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        const next = yield* Effect.forEach(twoSlots, () =>
          scheduler
            .schedule(Effect.sleep('9 minutes'), () => Effect.void)
            .pipe(Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        let started = false;
        const queued = yield* scheduler
          .schedule(
            Effect.sync(() => {
              started = true;
            }),
            () => Effect.void,
          )
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('10 minutes');
        expect(yield* Fiber.join(queued)).toMatchObject({
          _tag: 'Left',
          left: {
            message:
              'The studio picture waited too long for an image slot. Try again later.',
          },
        });
        expect(started).toBe(false);
        yield* TestClock.adjust('8 minutes');
        yield* Effect.forEach([...blockers, ...next], Fiber.join);
        const jobs = yield* Effect.forEach(twoSlots, () =>
          scheduler
            .schedule(
              Effect.sleep('1 second').pipe(Effect.as('picture')),
              () => Effect.void,
            )
            .pipe(Effect.fork),
        );
        yield* TestClock.adjust('1 second');
        expect(yield* Effect.forEach(jobs, Fiber.join)).toEqual([
          'picture',
          'picture',
        ]);
      }),
    );
  });
});

describe('concurrent studio cooldowns', () => {
  it('rechecks a cooldown extended by the other active request', async () => {
    await run(
      Effect.gen(function* () {
        const scheduler = yield* makeStudioScheduler;
        let firstCalls = 0;
        let secondCalls = 0;
        const limited = (delay: string) =>
          Effect.fail(
            new StudioRateLimit({
              message: 'Busy',
              retryAfter: delay,
              retryAfterSeconds: null,
              cause: undefined,
            }),
          );
        const first = yield* scheduler
          .schedule(
            Effect.suspend(() => {
              firstCalls += 1;
              return firstCalls === 1
                ? Effect.sleep('1 second').pipe(Effect.andThen(limited('2000')))
                : Clock.currentTimeMillis;
            }),
            () => Effect.void,
          )
          .pipe(Effect.fork);
        const second = yield* scheduler
          .schedule(
            Effect.suspend(() => {
              secondCalls += 1;
              return secondCalls === 1
                ? Effect.sleep('2 seconds').pipe(
                    Effect.andThen(limited('4000')),
                  )
                : Clock.currentTimeMillis;
            }),
            () => Effect.void,
          )
          .pipe(Effect.fork);
        yield* TestClock.adjust('3 seconds');
        expect(firstCalls).toBe(1);
        expect(secondCalls).toBe(1);
        yield* TestClock.adjust('3 seconds');
        const cooldownEnd = 6000;
        expect(yield* Fiber.join(first)).toBe(cooldownEnd);
        expect(yield* Fiber.join(second)).toBe(cooldownEnd);
      }),
    );
  });
});
