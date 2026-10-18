import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import type { GarmentStatus } from '#/shared/data/garment-types.ts';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { tick } from './today-actions.ts';

const today = localDate('2026-10-18');

const clock: WardrobeClock = {
  settings: {
    location: {
      name: 'Berlin',
      region: 'Berlin',
      country: 'Germany',
      latitude: 52.52,
      longitude: 13.41,
      timezone: 'Europe/Berlin',
    },
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

const garment = (status: GarmentStatus): Garment => ({
  id: '0398ab00-0000-4000-8000-000000000001',
  status,
  name: 'Jeans',
  category: 'jeans',
  subcategory: '',
  slots: ['bottom'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  washedOn: null,
  washedAfterWear: false,
  laundryStartedOn: null,
  laundryReadyOn: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  images: {},
});

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
  createdAt: new Date('2026-10-18T05:00:00Z'),
  decidedAt: null,
};

describe('the scheduled tick', () => {
  it.each([
    ['an empty wardrobe', [], 'skipped', 0],
    [
      'a wardrobe with nothing active',
      [garment('review'), garment('retired')],
      'skipped',
      0,
    ],
    ['a wardrobe with an active garment', [garment('active')], 'proposed', 1],
  ] as const)('for %s', async (_, wardrobe, outcome, proposals) => {
    let ensured = 0;
    const result = await Effect.runPromise(
      tick(
        {
          garments: { list: () => Effect.succeed(wardrobe) },
          wearLog: { readDay: () => Effect.succeed([]) },
          proposalService: {
            ensure: () =>
              Effect.sync(() => {
                ensured += 1;
                return proposal;
              }),
          },
        },
        clock,
      ),
    );
    expect(result).toBe(outcome);
    expect(ensured).toBe(proposals);
  });
});
