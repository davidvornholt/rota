import { describe, expect, it } from 'bun:test';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  candidatesFor,
  consecutiveWears,
  continuations,
  daysSinceWorn,
  previousLoggedDay,
  warmthBand,
} from './rotation.ts';

const garment = (
  id: string,
  slots: ReadonlyArray<Slot>,
  overrides: Partial<Garment> = {},
): Garment => ({
  id,
  status: 'active',
  name: id,
  category: slots[0] === 'bottom' ? 'trousers' : 'shirt',
  subcategory: '',
  slots,
  warmth: 3,
  rainOk: true,
  formality: 3,
  wearBudget: null,
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  seasons: [],
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  retiredAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  images: {},
  ...overrides,
});

const worn = (date: string, garmentId: string, slot: Slot): WearEntry => ({
  wornOn: localDate(date),
  garmentId,
  slot,
  source: 'proposed',
});

const mild: WeatherDay = {
  date: localDate('2026-09-04'),
  issuedOn: localDate('2026-09-04'),
  locationLabel: 'Berlin',
  high: 19,
  low: 11,
  precipitationProbability: 10,
  precipitationMm: 0,
  windKmh: 12,
  weatherCode: 1,
};

const today = localDate('2026-09-04');
const threeDays = 3;
const fourDays = 4;
const hotBand = 1;
const warmBand = 2;
const mildBand = 3;
const coolBand = 4;
const coldBand = 5;

describe('consecutive wear', () => {
  it('counts back over logged days and stops at the first day the garment was off', () => {
    const log = [
      worn('2026-09-01', 'chinos', 'bottom'),
      worn('2026-09-02', 'chinos', 'bottom'),
      worn('2026-09-03', 'chinos', 'bottom'),
      worn('2026-09-03', 'tee', 'top'),
      worn('2026-08-31', 'jeans', 'bottom'),
    ];
    expect(consecutiveWears(log, 'chinos', today)).toBe(threeDays);
    expect(consecutiveWears(log, 'tee', today)).toBe(1);
    expect(consecutiveWears(log, 'jeans', today)).toBe(0);
  });

  it('walks across an unlogged day but not across a long silence', () => {
    const shortGap = [
      worn('2026-09-01', 'chinos', 'bottom'),
      worn('2026-09-03', 'chinos', 'bottom'),
    ];
    expect(consecutiveWears(shortGap, 'chinos', today)).toBe(2);

    const longSilence = [
      worn('2026-08-20', 'chinos', 'bottom'),
      worn('2026-08-21', 'chinos', 'bottom'),
    ];
    expect(consecutiveWears(longSilence, 'chinos', today)).toBe(0);
    expect(previousLoggedDay(longSilence, today)).toBeUndefined();
  });
});

describe('continuations', () => {
  const settings = { cooldownDays: 7, categoryBudgets: {} };

  it('carries over garments with budget left and drops the ones that are spent', () => {
    const log = [
      worn('2026-09-01', 'chinos', 'bottom'),
      worn('2026-09-02', 'chinos', 'bottom'),
      worn('2026-09-02', 'oxford', 'top'),
      worn('2026-09-03', 'chinos', 'bottom'),
      worn('2026-09-03', 'oxford', 'top'),
    ];
    const result = continuations({
      today,
      log,
      garments: [
        garment('chinos', ['bottom']),
        garment('oxford', ['top', 'over']),
      ],
      settings,
      weather: mild,
      excluded: new Set(),
    });
    expect(
      result.map((c) => [c.slot, c.garment.id, c.dayOfBudget, c.budget]),
    ).toEqual([['bottom', 'chinos', fourDays, fourDays]]);
  });

  it('honours a per-garment budget override and the exclusion list', () => {
    const log = [
      worn('2026-09-03', 'linen', 'top'),
      worn('2026-09-03', 'chinos', 'bottom'),
    ];
    const result = continuations({
      today,
      log,
      garments: [
        garment('linen', ['top'], { wearBudget: 1 }),
        garment('chinos', ['bottom']),
      ],
      settings,
      weather: mild,
      excluded: new Set(['chinos']),
    });
    expect(result).toEqual([]);
  });

  it('flags a continuation the weather no longer suits', () => {
    const log = [worn('2026-09-03', 'wool', 'over')];
    const [result] = continuations({
      today,
      log,
      garments: [garment('wool', ['over'], { warmth: 5, category: 'jumper' })],
      settings,
      weather: { ...mild, high: 29, low: 18 },
      excluded: new Set(),
    });
    expect(result?.weatherFits).toBeFalse();
  });
});

describe('candidates', () => {
  const settings = { cooldownDays: 7, categoryBudgets: {} };
  const wardrobe = [
    garment('rested', ['top']),
    garment('recent', ['top']),
    garment('never', ['top']),
    garment('hot-only', ['top'], { warmth: 1 }),
    garment('suede', ['top'], { rainOk: false }),
    garment('retired', ['top'], { status: 'retired' }),
    garment('trousers', ['bottom']),
  ];
  const log = [
    worn('2026-08-20', 'rested', 'top'),
    worn('2026-09-02', 'recent', 'top'),
  ];

  it('offers rested, weather-fit garments for the slot, never-worn first', () => {
    const result = candidatesFor(
      {
        today,
        log,
        garments: wardrobe,
        settings,
        weather: mild,
        excluded: new Set(),
      },
      'top',
      new Set(),
    );
    expect(result.map((c) => c.garment.id)).toEqual([
      'never',
      'suede',
      'rested',
    ]);
    expect(result.every((c) => !c.inCooldown)).toBeTrue();
  });

  it('drops rain-shy garments on a wet day and falls back to cooldown garments when nothing else fits', () => {
    const wet = { ...mild, precipitationProbability: 80 };
    const onlyRecent = [
      garment('recent', ['top']),
      garment('suede', ['top'], { rainOk: false }),
    ];
    const result = candidatesFor(
      {
        today,
        log,
        garments: onlyRecent,
        settings,
        weather: wet,
        excluded: new Set(),
      },
      'top',
      new Set(),
    );
    expect(result.map((c) => [c.garment.id, c.inCooldown])).toEqual([
      ['recent', true],
    ]);
  });

  it('measures days since worn against the day being dressed', () => {
    expect(daysSinceWorn(log, 'recent', today)).toBe(2);
    expect(daysSinceWorn(log, 'never', today)).toBeNull();
  });
});

describe('warmth band', () => {
  it('leans on the high and steps every six degrees or so', () => {
    expect(warmthBand({ high: 30, low: 20 })).toBe(hotBand);
    expect(warmthBand({ high: 22, low: 14 })).toBe(warmBand);
    expect(warmthBand({ high: 16, low: 9 })).toBe(mildBand);
    expect(warmthBand({ high: 9, low: 3 })).toBe(coolBand);
    expect(warmthBand({ high: 2, low: -4 })).toBe(coldBand);
  });
});
