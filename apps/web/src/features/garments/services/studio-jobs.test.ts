import { describe, expect, it } from 'bun:test';
import { Effect, TestClock, TestContext } from 'effect';
import { makeStudioJobs } from './studio-jobs.ts';

describe('studio jobs', () => {
  it('registers before returning, suppresses duplicates until storage finishes, and allows another attempt', async () => {
    let starts = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        const jobs = makeStudioJobs();
        const work = () =>
          Effect.gen(function* () {
            starts += 1;
            yield* Effect.sleep('1 second');
          });
        expect(yield* jobs.start('shirt', work)).toBe(true);
        expect(jobs.progress().get('shirt')).toEqual({ status: 'queued' });
        expect(yield* jobs.start('shirt', work)).toBe(false);
        yield* TestClock.adjust('1 second');
        expect(starts).toBe(1);
        expect(jobs.progress().has('shirt')).toBe(false);
        yield* jobs.start('shirt', work);
        yield* TestClock.adjust('1 second');
        expect(starts).toBe(2);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });

  it('publishes waiting progress and returns independent snapshots for polling', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const jobs = makeStudioJobs();
        yield* jobs.start('shirt', (report) =>
          report({ status: 'waiting', retryAt: 1000 }).pipe(
            Effect.andThen(Effect.sleep('1 second')),
          ),
        );
        yield* TestClock.adjust('1 millis');
        const snapshot = jobs.progress();
        expect(snapshot.get('shirt')).toEqual({
          status: 'waiting',
          retryAt: 1000,
        });
        yield* TestClock.adjust('1 second');
        expect(jobs.progress().size).toBe(0);
        expect(snapshot.size).toBe(1);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });
  it('cleans up an interrupted job so a later request can run', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const jobs = makeStudioJobs();
        yield* jobs.start('shirt', () => Effect.interrupt);
        yield* TestClock.adjust('1 millis');
        expect(jobs.progress().size).toBe(0);
        yield* jobs.start('shirt', () => Effect.sleep('1 second'));
        expect(jobs.progress().has('shirt')).toBe(true);
        yield* TestClock.adjust('1 second');
        expect(jobs.progress().size).toBe(0);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });
});
