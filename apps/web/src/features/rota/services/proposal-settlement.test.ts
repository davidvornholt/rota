import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Fiber, TestClock, TestContext } from 'effect';
import { runSessionRequired } from '#/shared/auth/session-required.ts';
import type { DayPlan } from '#/shared/data/outfit.ts';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  ProposalGenerationError,
  SlotEmptyError,
} from '../errors/rota-errors.ts';
import type { ForecastWindow } from './forecast-service.ts';
import { makeProposalOperations } from './proposal-operations.ts';
import type { GenerateOptions } from './proposal-service.ts';
import type { SettlementDeps } from './proposal-settlement.ts';

const today = localDate('2026-09-07');
const shortsId = '0398ab00-0000-4000-8000-000000000001';
const teeId = '3b97f500-0000-4000-8000-000000000002';
const jumperId = 'd9c7b500-0000-4000-8000-000000000003';

const day: WeatherDay = {
  date: today,
  issuedOn: today,
  locationLabel: 'Berlin',
  high: 24,
  low: 15,
  precipitationProbability: 5,
  precipitationMm: 0,
  windKmh: 8,
  weatherCode: 1,
};
const forecast: ForecastWindow = {
  today: day,
  yesterday: undefined,
  tomorrow: undefined,
  upcoming: [],
  stale: false,
};

const clock: WardrobeClock = {
  settings: {
    location: null,
    cleanTopAnchor: null,
    laundryDays: 4,
    cooldownDays: 3,
    categoryBudgets: {},
    proposalHour: 5,
  },
  timeZone: 'Europe/Berlin',
  today,
  actualToday: today,
  hour: 9,
};

const pending: Proposal = {
  id: 'a0000000-0000-4000-8000-000000000000',
  forDate: today,
  status: 'pending',
  payload: {
    items: [
      {
        garmentId: shortsId,
        slot: 'bottom',
        continued: true,
        dayOfBudget: 2,
        budget: 4,
        reason: 'Day two.',
      },
      {
        garmentId: teeId,
        slot: 'top',
        continued: false,
        dayOfBudget: 1,
        budget: 2,
        reason: 'Fresh.',
      },
    ],
    headline: 'Shorts and a tee.',
    excludedGarmentIds: [jumperId],
    forecastStale: false,
    occasion: null,
  },
  reason: 'Shorts and a tee.',
  model: 'test',
  createdAt: new Date('2026-09-07T05:00:00Z'),
  decidedAt: null,
};

type Recorded = {
  readonly plans: Array<Pick<DayPlan, 'entries' | 'basedOn' | 'forecast'>>;
  readonly sources: Array<string>;
  readonly notes: Array<string>;
  readonly statuses: Array<readonly [string, string]>;
  readonly generated: Array<GenerateOptions>;
};

const depsWith = (
  generateOutcome: 'succeeds' | 'fails',
): { readonly deps: SettlementDeps; readonly recorded: Recorded } => {
  const recorded: Recorded = {
    plans: [],
    statuses: [],
    generated: [],
    notes: [],
    sources: [],
  };
  const deps = {
    outfits: {
      plan: () => Effect.succeed({ entries: null }),
      savePlan: (
        _date: unknown,
        plan: Pick<DayPlan, 'entries' | 'basedOn' | 'forecast'>,
      ) =>
        Effect.sync(() => {
          recorded.plans.push(plan);
        }),
    },
    proposals: {
      byId: () => Effect.succeed(pending),
      latestForDate: () => Effect.succeed(pending),
      setStatus: (id: string, status: string) => {
        recorded.statuses.push([id, status]);
        return Effect.void;
      },
    },
    notes: {
      save: (_date: string, note: string) =>
        Effect.sync(() => {
          recorded.notes.push(note);
        }),
    },
    wearLog: {
      readDay: () => Effect.succeed([]),
      replaceDay: (_date: unknown, _entries: unknown, source: string) =>
        Effect.sync(() => {
          recorded.sources.push(source);
        }),
    },
    forecasts: { ensure: () => Effect.succeed(forecast) },
    generate: (
      _clock: WardrobeClock,
      _forecast: ForecastWindow,
      options: GenerateOptions,
    ) => {
      recorded.generated.push(options);
      return generateOutcome === 'succeeds'
        ? Effect.succeed({
            ...pending,
            id: 'b0000000-0000-4000-8000-000000000000',
          })
        : Effect.fail(new SlotEmptyError('bottom'));
    },
  } as unknown as SettlementDeps;
  return { deps, recorded };
};

describe('completing an outfit', () => {
  it.each([true, false])(
    'records whether the proposal was accepted (%s)',
    async (accepted) => {
      const { deps, recorded } = depsWith('succeeds');
      const entries = pending.payload.items.map(({ slot, garmentId }) => ({
        slot,
        garmentId: !accepted && slot === 'top' ? jumperId : garmentId,
      }));
      await Effect.runPromise(
        Effect.flatMap(makeProposalOperations(deps), (operations) =>
          operations.wear(clock, entries),
        ),
      );
      expect(recorded.sources).toEqual([accepted ? 'proposed' : 'override']);
      expect(recorded.statuses).toEqual([
        [pending.id, accepted ? 'confirmed' : 'superseded'],
      ]);
    },
  );
  it('keeps selected pieces and excludes prior unselected suggestions', async () => {
    const { deps, recorded } = depsWith('succeeds');
    const pins = [{ slot: 'top' as const, garmentId: teeId }];
    await Effect.runPromise(
      Effect.flatMap(makeProposalOperations(deps), (operations) =>
        operations.complete(clock, pins),
      ),
    );
    expect(recorded.generated[0]?.pinned).toEqual(pins);
    expect(recorded.generated[0]?.excluded.has(teeId)).toBeFalse();
    expect(recorded.generated[0]?.excluded.has(shortsId)).toBeTrue();
    expect(recorded.generated[0]?.rejectedProposalId).toBe(pending.id);
    expect(recorded.statuses).toEqual([]);
  });
  it('leaves the previous proposal intact when completion fails', async () => {
    const { deps, recorded } = depsWith('fails');
    const result = await Effect.runPromise(
      Effect.either(
        Effect.flatMap(makeProposalOperations(deps), (operations) =>
          operations.complete(clock, []),
        ),
      ),
    );
    expect(result._tag).toBe('Left');
    expect(recorded.statuses).toEqual([]);
  });
});

describe('proposal operations', () => {
  it('saves an empty draft without recording wear and rejects autosave after wear', async () => {
    const { deps, recorded } = depsWith('succeeds');
    const draft = { entries: [], basedOn: null, forecast: null };
    const operations = await Effect.runPromise(makeProposalOperations(deps));
    await Effect.runPromise(operations.savePlan(clock, draft));
    expect(recorded.plans).toEqual([draft]);
    expect(recorded.sources).toEqual([]);
    deps.wearLog.readDay = () =>
      Effect.succeed([
        {
          garmentId: teeId,
          slot: 'top',
          wornOn: today,
          source: 'proposed',
        },
      ]);
    const result = await Effect.runPromise(
      Effect.either(operations.savePlan(clock, draft)),
    );
    expect(result._tag).toBe('Left');
    expect(recorded.plans).toEqual([draft]);
  });

  it('makes concurrent morning requests share the stored proposal', async () => {
    const { deps } = depsWith('succeeds');
    let stored: Proposal | undefined;
    let generated = 0;
    deps.proposals.latestForDate = () => Effect.sync(() => stored);
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const finish = yield* Deferred.make<void>();
      const operations = yield* makeProposalOperations({
        ...deps,
        generate: () =>
          Effect.gen(function* () {
            generated += 1;
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(finish);
            stored = pending;
            return pending;
          }),
      });
      const first = yield* Effect.fork(operations.ensure(clock));
      yield* Deferred.await(started);
      const second = yield* Effect.fork(operations.ensure(clock));
      yield* Deferred.succeed(finish, undefined);
      return yield* Effect.all([Fiber.join(first), Fiber.join(second)]);
    });
    expect(await Effect.runPromise(result)).toEqual([pending, pending]);
    expect(generated).toBe(1);
  });

  it('bounds stuck generation, interrupts it and releases the gate for retry', async () => {
    const { deps } = depsWith('succeeds');
    deps.proposals.latestForDate = () => Effect.succeed(undefined);
    let interrupted = false;
    let stuck = true;
    const result = Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const operations = yield* makeProposalOperations({
        ...deps,
        generate: () =>
          stuck
            ? Deferred.succeed(started, undefined).pipe(
                Effect.zipRight(Effect.never),
                Effect.onInterrupt(() =>
                  Effect.sync(() => {
                    interrupted = true;
                  }),
                ),
              )
            : Effect.succeed(pending),
      });
      const first = yield* Effect.fork(Effect.either(operations.ensure(clock)));
      yield* Deferred.await(started);
      yield* TestClock.adjust('361 seconds');
      const outcome = yield* Fiber.join(first);
      expect(outcome._tag).toBe('Left');
      expect(interrupted).toBeTrue();
      stuck = false;
      return yield* operations.ensure(clock);
    }).pipe(Effect.provide(TestContext.TestContext));
    expect(await Effect.runPromise(result)).toEqual(pending);
  });
});

it('returns a safe timeout through authentication while retaining the previous proposal', async () => {
  const { deps, recorded } = depsWith('succeeds');
  const failingDeps = {
    ...deps,
    generate: () =>
      Effect.fail(
        new ProposalGenerationError(true, new Error('private provider detail')),
      ),
  };
  const failedDependency = 424;
  const response = runSessionRequired({
    transport: 'server-function',
    authorize: () => Promise.resolve(true),
    next: () =>
      Effect.runPromise(
        Effect.flatMap(makeProposalOperations(failingDeps), (operations) =>
          operations.complete(clock, []),
        ),
      ),
    publishHeaders: () => undefined,
    publishStatus: (status) => {
      expect(status).toBe(failedDependency);
    },
  });
  await expect(response).rejects.toThrow(
    'Choosing an outfit timed out. Please try again.',
  );
  expect(recorded.statuses).toEqual([]);
});
