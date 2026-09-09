import { describe, expect, it } from 'bun:test';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  candidatesFor,
  consecutiveWears,
  continuations,
  daysSinceWorn,
  previousLoggedDay,
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
  studioError: null,
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

const today = localDate('2026-09-04');
const threeDays = 3;
const fourDays = 4;

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
      excluded: new Set(['chinos']),
    });
    expect(result).toEqual([]);
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

  it('offers available rested garments for the slot, never-worn first', () => {
    const result = candidatesFor(
      {
        today,
        log,
        garments: wardrobe,
        settings,
        excluded: new Set(),
      },
      'top',
      new Set(),
    );
    expect(result.map((c) => c.garment.id)).toEqual([
      'never',
      'hot-only',
      'suede',
      'rested',
    ]);
    expect(result.every((c) => !c.inCooldown)).toBeTrue();
  });

  it('falls back to cooldown garments when none are rested', () => {
    const result = candidatesFor(
      {
        today,
        log,
        garments: [garment('recent', ['top'])],
        settings,
        excluded: new Set(),
      },
      'top',
      new Set(),
    );
    expect(result.map((c) => [c.garment.id, c.inCooldown])).toEqual([
      ['recent', true],
    ]);
  });

  it('offers every insulation level even when more than eight medium garments are available', () => {
    const mediumCount = 9;
    const garments = [
      ...Array.from({ length: mediumCount }, (_, index) =>
        garment(`medium-${index}`, ['top']),
      ),
      garment('light-shirt', ['top'], { warmth: 1 }),
      garment('heavy-knit', ['top'], { warmth: 3 }),
      garment('rain-sensitive', ['top'], { rainOk: false }),
    ];
    const result = candidatesFor(
      { today, log: [], garments, settings, excluded: new Set() },
      'top',
      new Set(),
    );
    expect(result.map((c) => c.garment.id)).toEqual(garments.map((g) => g.id));
  });

  it('excludes unavailable, rejected and already offered garments', () => {
    const result = candidatesFor(
      {
        today,
        log: [],
        settings,
        garments: [
          garment('available', ['top']),
          garment('rejected', ['top']),
          garment('continuing', ['top']),
          garment('retired', ['top'], { status: 'retired' }),
          garment('bottom', ['bottom']),
        ],
        excluded: new Set(['rejected']),
      },
      'top',
      new Set(['continuing']),
    );
    expect(result.map((c) => c.garment.id)).toEqual(['available']);
  });

  it('measures days since worn against the day being dressed', () => {
    expect(daysSinceWorn(log, 'recent', today)).toBe(2);
    expect(daysSinceWorn(log, 'never', today)).toBeNull();
  });
});
