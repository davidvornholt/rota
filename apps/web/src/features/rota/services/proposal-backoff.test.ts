import { describe, expect, it } from 'bun:test';
import { Clock, Effect } from 'effect';
import { TestClock } from 'effect/testing';
import type {
  Proposal,
  ScheduledFailures,
} from '#/shared/data/proposal-repository.ts';
import { addDays, localDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalGenerationError } from '../errors/rota-errors.ts';
import {
  afterFailure,
  scheduledAttempt,
  scheduledAttemptsPerDay,
} from './proposal-backoff.ts';
import { makeProposalOperations } from './proposal-operations.ts';
import type { SettlementDeps } from './proposal-settlement.ts';

const today = localDate('2026-10-18');
const yesterday = addDays(today, -1);
const minute = 60_000;
const failedAt = new Date('2026-10-18T05:00:00Z');
const minutesLater = (minutes: number) =>
  new Date(failedAt.getTime() + minutes * minute);

const clock: WardrobeClock = {
  settings: {
    location: null,
    cleanTopAnchor: null,
    laundryDays: 4,
    cooldownDays: 7,
    categoryBudgets: {},
    proposalHour: 5,
  },
  timeZone: 'Europe/Berlin',
  today,
  actualToday: today,
  hour: 9,
};

const proposal: Proposal = {
  id: 'a0000000-0000-4000-8000-000000000000',
  forDate: today,
  status: 'pending',
  payload: {
    items: [],
    headline: '',
    excludedGarmentIds: [],
    forecastStale: false,
    occasion: null,
  },
  reason: '',
  model: 'test',
  createdAt: failedAt,
  decidedAt: null,
};

/** The stored backoff row and proposal, and a model that fails until told otherwise. */
const wardrobe = () => {
  const state = {
    backoff: undefined as ScheduledFailures | undefined,
    stored: undefined as Proposal | undefined,
    failing: true,
    /** When the model was asked, in milliseconds on the test clock. */
    asked: [] as Array<number>,
  };
  const deps = {
    outfits: { plan: () => Effect.succeed({ entries: null }) },
    proposals: {
      latestForDate: () => Effect.sync(() => state.stored),
      scheduledFailures: () => Effect.sync(() => state.backoff),
      saveScheduledFailures: (next: ScheduledFailures) =>
        Effect.sync(() => {
          state.backoff = next;
        }),
      clearScheduledFailures: (date: string) =>
        Effect.sync(() => {
          if (state.backoff?.forDate === date) {
            state.backoff = undefined;
          }
        }),
    },
    wearLog: { readDay: () => Effect.succeed([]) },
    forecasts: { ensure: () => Effect.succeed(undefined) },
    generate: () =>
      Effect.gen(function* () {
        state.asked.push(yield* Clock.currentTimeMillis);
        if (state.failing) {
          return yield* new ProposalGenerationError(false, undefined);
        }
        state.stored = proposal;
        return proposal;
      }),
  } as unknown as SettlementDeps;
  return { deps, state };
};

const onTestClock = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

describe('the scheduled retry schedule', () => {
  it('lets the first attempt of a day run', () => {
    expect(scheduledAttempt(undefined, today, failedAt)).toBe('due');
  });

  it.each([
    [1, 10],
    [2, 20],
    [3, 40],
    [4, 80],
  ])('waits after %i failures for %i minutes', (failures, minutes) => {
    const state = { forDate: today, failures, lastFailedAt: failedAt };
    expect(
      scheduledAttempt(
        state,
        today,
        new Date(minutesLater(minutes).getTime() - 1),
      ),
    ).toBe('waiting');
    expect(scheduledAttempt(state, today, minutesLater(minutes))).toBe('due');
  });

  it('stops for the rest of the day after five failed attempts', () => {
    const state = {
      forDate: today,
      failures: scheduledAttemptsPerDay,
      lastFailedAt: failedAt,
    };
    expect(scheduledAttempt(state, today, minutesLater(18 * 60))).toBe(
      'exhausted',
    );
  });

  it('starts a new day fresh', () => {
    const state = {
      forDate: yesterday,
      failures: scheduledAttemptsPerDay,
      lastFailedAt: failedAt,
    };
    expect(scheduledAttempt(state, today, minutesLater(1))).toBe('due');
    expect(afterFailure(state, today, minutesLater(1))).toEqual({
      forDate: today,
      failures: 1,
      lastFailedAt: minutesLater(1),
    });
  });

  it('counts each failure of the same day', () => {
    const state = { forDate: today, failures: 2, lastFailedAt: failedAt };
    expect(afterFailure(state, today, minutesLater(30))).toEqual({
      forDate: today,
      failures: 3,
      lastFailedAt: minutesLater(30),
    });
  });
});

describe('scheduled proposals after a failure', () => {
  it('ask a failing model at most five times a day, on a doubling schedule', async () => {
    const { deps, state } = wardrobe();
    const outcomes = await onTestClock(
      Effect.gen(function* () {
        const operations = yield* makeProposalOperations(deps);
        const seen: Array<string> = [];
        // One scheduler tick a minute for six hours.
        for (let tick = 0; tick < 6 * 60; tick += 1) {
          const outcome = yield* Effect.result(operations.ensure(clock));
          seen.push(outcome._tag === 'Success' ? outcome.success : 'failed');
          yield* TestClock.adjust('1 minute');
        }
        return seen;
      }),
    );
    expect(state.asked.map((at) => at / minute)).toEqual([0, 10, 30, 70, 150]);
    expect(outcomes.filter((outcome) => outcome === 'failed')).toHaveLength(5);
    expect(outcomes.filter((outcome) => outcome === 'waiting')).toHaveLength(
      6 * 60 - 5,
    );
    expect(state.backoff?.failures).toBe(scheduledAttemptsPerDay);
  });

  it('keep waiting after a restart, because the count is stored', async () => {
    const { deps, state } = wardrobe();
    await onTestClock(
      Effect.gen(function* () {
        const before = yield* makeProposalOperations(deps);
        yield* Effect.result(before.ensure(clock));
        // A restarted process builds its operations again with nothing in memory.
        const restarted = yield* makeProposalOperations(deps);
        yield* TestClock.adjust('9 minutes');
        expect(yield* restarted.ensure(clock)).toBe('waiting');
        yield* TestClock.adjust('1 minute');
        yield* Effect.result(restarted.ensure(clock));
      }),
    );
    expect(state.asked).toEqual([0, 10 * minute]);
  });

  it('clear the backoff once an attempt succeeds', async () => {
    const { deps, state } = wardrobe();
    await onTestClock(
      Effect.gen(function* () {
        const operations = yield* makeProposalOperations(deps);
        yield* Effect.result(operations.ensure(clock));
        expect(state.backoff?.failures).toBe(1);
        state.failing = false;
        yield* TestClock.adjust('10 minutes');
        expect(yield* operations.ensure(clock)).toBe('proposed');
      }),
    );
    expect(state.backoff).toBeUndefined();
  });

  it('start a new day fresh after the previous day ran out of attempts', async () => {
    const { deps, state } = wardrobe();
    state.backoff = {
      forDate: yesterday,
      failures: scheduledAttemptsPerDay,
      lastFailedAt: new Date(0),
    };
    await onTestClock(
      Effect.gen(function* () {
        const operations = yield* makeProposalOperations(deps);
        yield* Effect.result(operations.ensure(clock));
      }),
    );
    expect(state.asked).toEqual([0]);
    expect(state.backoff).toEqual({
      forDate: today,
      failures: 1,
      lastFailedAt: new Date(0),
    });
  });

  it("never hold back the wearer's own request, whose success ends the backoff", async () => {
    const { deps, state } = wardrobe();
    const exhausted = {
      forDate: today,
      failures: scheduledAttemptsPerDay,
      lastFailedAt: new Date(0),
    };
    state.backoff = exhausted;
    await onTestClock(
      Effect.gen(function* () {
        const operations = yield* makeProposalOperations(deps);
        const failed = yield* Effect.result(operations.complete(clock, []));
        expect(failed._tag).toBe('Failure');
        expect(state.backoff).toEqual(exhausted);
        state.failing = false;
        yield* operations.complete(clock, []);
        expect(state.backoff).toBeUndefined();
        expect(yield* operations.ensure(clock)).toBe('proposed');
      }),
    );
    expect(state.asked).toEqual([0, 0]);
  });
});
