import { describe, expect, it } from 'bun:test';
import type { Garment } from '#/shared/data/garment.ts';
import { wearsSinceWash } from '#/shared/data/garment-care.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  candidatesFor,
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
  washedOn: null,
  washedAfterWear: false,
  inLaundry: false,
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

describe('wears between washes', () => {
  it('counts all actual wears, including separate days', () => {
    const log = [
      worn('2026-09-01', 'chinos', 'bottom'),
      worn('2026-09-02', 'chinos', 'bottom'),
      worn('2026-09-03', 'chinos', 'bottom'),
      worn('2026-09-03', 'tee', 'top'),
      worn('2026-08-31', 'jeans', 'bottom'),
    ];
    expect(wearsSinceWash(log, garment('chinos', ['bottom']), today)).toBe(
      threeDays,
    );
    expect(wearsSinceWash(log, garment('tee', ['top']), today)).toBe(1);
    expect(wearsSinceWash(log, garment('jeans', ['bottom']), today)).toBe(1);
  });

  it('does not mistake unlogged days or a long rest for washing', () => {
    const shortGap = [
      worn('2026-09-01', 'chinos', 'bottom'),
      worn('2026-09-03', 'chinos', 'bottom'),
    ];
    expect(wearsSinceWash(shortGap, garment('chinos', ['bottom']), today)).toBe(
      2,
    );

    const longSilence = [
      worn('2026-08-20', 'chinos', 'bottom'),
      worn('2026-08-21', 'chinos', 'bottom'),
    ];
    expect(
      wearsSinceWash(longSilence, garment('chinos', ['bottom']), today),
    ).toBe(2);
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
      cleanTop: false,
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
      cleanTop: false,
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
        cleanTop: false,
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
      'recent',
    ]);
    expect(result.filter((c) => c.inCooldown).map((c) => c.garment.id)).toEqual(
      ['recent'],
    );
  });

  it('falls back to cooldown garments when none are rested', () => {
    const result = candidatesFor(
      {
        cleanTop: false,
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
      {
        cleanTop: false,
        today,
        log: [],
        garments,
        settings,
        excluded: new Set(),
      },
      'top',
      new Set(),
    );
    expect(result.map((c) => c.garment.id)).toEqual(garments.map((g) => g.id));
  });

  it('excludes unavailable, rejected and already offered garments', () => {
    const result = candidatesFor(
      {
        cleanTop: false,
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

describe('daily variety and laundry', () => {
  const settings = { cooldownDays: 0, categoryBudgets: {} };
  const top = garment('blue', ['top']);
  const white = garment('white', ['top']);
  const input = {
    today,
    cleanTop: false,
    settings,
    excluded: new Set<string>(),
    garments: [top, white],
    log: [worn('2026-09-03', 'blue', 'top')],
  };
  it('never automatically repeats yesterday’s top, even when it is the only one', () => {
    expect(
      candidatesFor(input, 'top', new Set()).map((item) => item.garment.id),
    ).toEqual(['white']);
    expect(
      candidatesFor({ ...input, garments: [top] }, 'top', new Set()),
    ).toEqual([]);
  });
  it('reuses a top on separate days and only a wash resets its allowance', () => {
    const log = [
      worn('2026-09-01', 'blue', 'top'),
      worn('2026-09-03', 'white', 'top'),
    ];
    expect(
      candidatesFor({ ...input, log }, 'top', new Set()).map(
        (item) => item.garment.id,
      ),
    ).toEqual(['blue']);
    expect(
      candidatesFor(
        { ...input, log: [...log, worn('2026-08-20', 'blue', 'top')] },
        'top',
        new Set(),
      ),
    ).toEqual([]);
    expect(
      candidatesFor({ ...input, log, cleanTop: true }, 'top', new Set()),
    ).toEqual([]);
    const washed = { ...top, washedOn: localDate('2026-09-02') };
    expect(
      candidatesFor(
        { ...input, garments: [washed], log, cleanTop: true },
        'top',
        new Set(),
      ).map((item) => item.garment.id),
    ).toEqual(['blue']);
  });
  it('excludes laundry regardless of rest days', () => {
    expect(
      candidatesFor(
        { ...input, garments: [{ ...white, inLaundry: true }] },
        'top',
        new Set(),
      ),
    ).toEqual([]);
  });
  it('allows shoes and bags to repeat without a wash allowance', () => {
    for (const [slot, category] of [
      ['shoes', 'shoes'],
      ['bag', 'handbag'],
    ] as const) {
      const accessory = garment('accessory', [slot], { category });
      const log = ['2026-09-01', '2026-09-02', '2026-09-03'].map((date) =>
        worn(date, accessory.id, slot),
      );
      expect(
        candidatesFor(
          {
            ...input,
            garments: [accessory, { ...accessory, id: 'unworn' }],
            log,
          },
          slot,
          new Set(),
        ).map((item) => item.garment.id),
      ).toEqual(['unworn', 'accessory']);
    }
  });
});
