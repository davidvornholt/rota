import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Fiber, TestClock, TestContext } from 'effect';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { SlotEmptyError } from '../errors/rota-errors.ts';
import type { ForecastWindow } from './forecast-service.ts';
import { makeProposalOperations } from './proposal-operations.ts';
import type { GenerateOptions } from './proposal-service.ts';
import {
  reroll,
  type SettlementDeps,
  saveOccasion,
} from './proposal-settlement.ts';

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
    cooldownDays: 3,
    categoryBudgets: {},
    proposalHour: 5,
  },
  timeZone: 'Europe/Berlin',
  today,
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
  readonly notes: Array<string>;
  readonly statuses: Array<readonly [string, string]>;
  readonly generated: Array<GenerateOptions>;
};

const depsWith = (
  generateOutcome: 'succeeds' | 'fails',
): { readonly deps: SettlementDeps; readonly recorded: Recorded } => {
  const recorded: Recorded = { statuses: [], generated: [], notes: [] };
  const deps = {
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
    wearLog: { readDay: () => Effect.succeed([]) },
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

describe('reroll', () => {
  it('retires the old proposal only after the new one exists', async () => {
    const { deps, recorded } = depsWith('succeeds');

    const next = await Effect.runPromise(
      reroll(deps, clock, pending.id, 'boundary'),
    );

    expect(next.id).not.toBe(pending.id);
    expect(recorded.statuses).toEqual([[pending.id, 'rejected']]);
  });

  it('leaves the old proposal pending when generation fails', async () => {
    const { deps, recorded } = depsWith('fails');

    const outcome = await Effect.runPromise(
      Effect.either(reroll(deps, clock, pending.id, 'all')),
    );

    expect(outcome._tag).toBe('Left');
    expect(recorded.statuses).toEqual([]);
  });

  it('turns down only the fresh picks for boundary and everything for all', async () => {
    const boundary = depsWith('succeeds');
    await Effect.runPromise(
      reroll(boundary.deps, clock, pending.id, 'boundary'),
    );
    expect(
      [...(boundary.recorded.generated[0]?.excluded ?? [])].sort(),
    ).toEqual([jumperId, teeId].sort());
    expect(boundary.recorded.generated[0]?.releaseAll).toBeFalse();

    const all = depsWith('succeeds');
    await Effect.runPromise(reroll(all.deps, clock, pending.id, 'all'));
    expect([...(all.recorded.generated[0]?.excluded ?? [])].sort()).toEqual(
      [jumperId, shortsId, teeId].sort(),
    );
    expect(all.recorded.generated[0]?.releaseAll).toBeTrue();
  });
});

describe('note regeneration', () => {
  it('keeps the saved note and pending outfit after failure', async () => {
    const { deps, recorded } = depsWith('fails');
    const outcome = await Effect.runPromise(
      Effect.either(saveOccasion(deps, clock, 'Meeting today')),
    );
    expect(outcome._tag).toBe('Left');
    expect(recorded.notes).toEqual(['Meeting today']);
    expect(recorded.statuses).toEqual([]);
    expect([...(recorded.generated[0]?.excluded ?? [])]).toEqual([jumperId]);
  });

  it('saves the note on a decided day without generating another outfit', async () => {
    const { deps, recorded } = depsWith('succeeds');
    deps.proposals.latestForDate = () =>
      Effect.succeed({ ...pending, status: 'confirmed' });
    await Effect.runPromise(saveOccasion(deps, clock, 'Meeting today'));
    expect(recorded.notes).toEqual(['Meeting today']);
    expect(recorded.generated).toEqual([]);
  });
});

describe('proposal operations', () => {
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
      yield* TestClock.adjust('181 seconds');
      const outcome = yield* Fiber.join(first);
      expect(outcome._tag).toBe('Left');
      expect(interrupted).toBeTrue();
      stuck = false;
      return yield* operations.ensure(clock);
    }).pipe(Effect.provide(TestContext.TestContext));
    expect(await Effect.runPromise(result)).toEqual(pending);
  });
});
