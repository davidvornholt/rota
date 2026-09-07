import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { SlotEmptyError } from '../errors/rota-errors.ts';
import type { ForecastWindow } from './forecast-service.ts';
import type { GenerateOptions } from './proposal-service.ts';
import { reroll, type SettlementDeps } from './proposal-settlement.ts';

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
  readonly statuses: Array<readonly [string, string]>;
  readonly generated: Array<GenerateOptions>;
};

const depsWith = (
  generateOutcome: 'succeeds' | 'fails',
): { readonly deps: SettlementDeps; readonly recorded: Recorded } => {
  const recorded: Recorded = { statuses: [], generated: [] };
  const deps = {
    proposals: {
      byId: () => Effect.succeed(pending),
      setStatus: (id: string, status: string) => {
        recorded.statuses.push([id, status]);
        return Effect.void;
      },
    },
    wearLog: {},
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
