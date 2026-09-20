import { describe, expect, it } from 'bun:test';
import { Effect, Fiber, TestClock, TestContext } from 'effect';
import { localDate } from '#/shared/time/local-date.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';
import { makeSuggestionJobs } from './suggestion-jobs.ts';

const today = localDate('2026-09-20');
const tomorrow = localDate('2026-09-21');
const run = <A, E>(work: Effect.Effect<A, E>) =>
  Effect.runPromise(work.pipe(Effect.provide(TestContext.TestContext)));

describe('background outfit suggestions', () => {
  it('returns immediately and deduplicates concurrent requests and completed retries', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        let calls = 0;
        const work = Effect.sync(() => {
          calls += 1;
        }).pipe(Effect.andThen(Effect.sleep('1 second')));
        const first = yield* jobs.start(today, 'first', work);
        expect(first.status).toBe('running');
        expect((yield* jobs.start(today, 'second', work)).id).toBe('first');
        expect((yield* jobs.status(today, null))?.id).toBe('first');
        yield* TestClock.adjust('1 second');
        expect((yield* jobs.start(today, 'first', work)).status).toBe(
          'succeeded',
        );
        expect(yield* jobs.status(today, null)).toBeNull();
        expect((yield* jobs.start(today, 'second', work)).status).toBe(
          'succeeded',
        );
        expect(calls).toBe(1);
        yield* jobs.start(today, 'third', work);
        yield* TestClock.adjust('1 second');
        expect(calls).toBe(2);
      }),
    );
  });
  it('continues after the initiating request fiber finishes', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        const request = yield* Effect.fork(
          jobs.start(today, 'first', Effect.sleep('1 second')),
        );
        expect((yield* Fiber.join(request)).status).toBe('running');
        yield* TestClock.adjust('1 second');
        expect((yield* jobs.status(today, 'first'))?.status).toBe('succeeded');
      }),
    );
  });
  it('keeps dates and wardrobe runtime instances independent', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        const otherOwner = makeSuggestionJobs();
        yield* jobs.start(today, 'first', Effect.sleep('1 second'));
        yield* jobs.start(tomorrow, 'second', Effect.sleep('1 second'));
        expect(yield* otherOwner.status(today, null)).toBeNull();
        expect((yield* jobs.status(tomorrow, 'first'))?.status).toBe('lost');
        expect((yield* jobs.status(tomorrow, null))?.id).toBe('second');
        yield* TestClock.adjust('1 second');
      }),
    );
  });
});

describe('background suggestion recovery', () => {
  it('publishes safe actionable failures and permits a fresh attempt', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        yield* jobs.start(
          today,
          'first',
          Effect.fail(new ProposalStateError('This day is already logged.')),
        );
        yield* TestClock.adjust('1 millis');
        expect((yield* jobs.status(today, 'first'))?.message).toBe(
          'This day is already logged.',
        );
        yield* jobs.start(
          today,
          'second',
          Effect.die('private provider diagnostic'),
        );
        yield* TestClock.adjust('1 millis');
        expect((yield* jobs.status(today, 'second'))?.status).toBe('failed');
        expect((yield* jobs.status(today, 'second'))?.message).not.toContain(
          'private',
        );
      }),
    );
  });
  it('interrupts a stuck operation at the deadline instead of leaving it running forever', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        let interrupted = false;
        yield* jobs.start(
          today,
          'first',
          Effect.never.pipe(
            Effect.ensuring(
              Effect.sync(() => {
                interrupted = true;
              }),
            ),
          ),
        );
        yield* TestClock.adjust('361 seconds');
        expect((yield* jobs.status(today, 'first'))?.status).toBe('failed');
        expect((yield* jobs.status(today, 'first'))?.message).toContain(
          'timed out',
        );
        expect(interrupted).toBe(true);
      }),
    );
  });
  it('reports interrupted jobs and expired or restarted jobs explicitly', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        yield* jobs.start(today, 'first', Effect.interrupt);
        yield* TestClock.adjust('1 millis');
        expect((yield* jobs.status(today, 'first'))?.status).toBe('failed');
        yield* TestClock.adjust('61 minutes');
        expect((yield* jobs.status(today, 'first'))?.status).toBe('lost');
        expect(
          (yield* makeSuggestionJobs().status(today, 'first'))?.status,
        ).toBe('lost');
      }),
    );
  });
  it('bounds retained request IDs without evicting an active job', async () => {
    await run(
      Effect.gen(function* () {
        const jobs = makeSuggestionJobs();
        yield* jobs.start(today, 'active', Effect.sleep('1 second'));
        yield* Effect.forEach(
          Array.from({ length: 20 }, (_, index) => `alias-${index}`),
          (id) => jobs.start(today, id, Effect.die('must not run')),
        );
        expect((yield* jobs.status(today, 'active'))?.status).toBe('running');
        expect((yield* jobs.status(today, 'alias-0'))?.status).toBe('lost');
        yield* TestClock.adjust('1 second');
        expect((yield* jobs.status(today, 'alias-19'))?.status).toBe(
          'succeeded',
        );
      }),
    );
  });
});
