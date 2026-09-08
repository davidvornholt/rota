import { describe, expect, it } from 'bun:test';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import type { RotationInput } from '../rotation.ts';
import { openSlotsFor } from './proposal-assembly.ts';
import type { OpenSlot } from './proposal-prompt.ts';

const garment = (id: string, slots: ReadonlyArray<Slot>): Garment => ({
  id,
  status: 'active',
  name: id,
  category: slots[0] === 'bottom' ? 'shorts' : 'shirt',
  subcategory: '',
  slots,
  warmth: 1,
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
});

const warm: WeatherDay = {
  date: localDate('2026-09-07'),
  issuedOn: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  high: 24,
  low: 15,
  precipitationProbability: 5,
  precipitationMm: 0,
  windKmh: 8,
  weatherCode: 1,
};

const shorts = garment('shorts', ['bottom']);
const linen = garment('linen', ['top']);
const tee = garment('tee', ['top']);

const input = (
  garments: ReadonlyArray<Garment>,
  excluded: ReadonlyArray<string>,
): RotationInput => ({
  today: localDate('2026-09-07'),
  log: [],
  garments,
  settings: { cooldownDays: 3, categoryBudgets: {} },
  weather: warm,
  excluded: new Set(excluded),
});

const slotNamed = (slots: ReadonlyArray<OpenSlot>, slot: Slot) =>
  slots.find((open) => open.slot === slot);

describe('openSlotsFor', () => {
  it('re-offers the turned-down garment when it is the only one that fits a required slot', () => {
    const open = openSlotsFor(
      input([shorts, linen, tee], ['shorts', 'linen']),
      [],
    );

    const bottom = slotNamed(open, 'bottom');
    expect(bottom?.turnedDownOnly).toBeTrue();
    expect(bottom?.candidates.map((c) => c.garment.id)).toEqual(['shorts']);

    const top = slotNamed(open, 'top');
    expect(top?.turnedDownOnly).toBeFalse();
    expect(top?.candidates.map((c) => c.garment.id)).toEqual(['tee']);
  });

  it('keeps a required slot empty when the wardrobe has nothing for it at all', () => {
    const open = openSlotsFor(input([linen, tee], ['linen']), []);

    const bottom = slotNamed(open, 'bottom');
    expect(bottom?.turnedDownOnly).toBeFalse();
    expect(bottom?.candidates).toEqual([]);
  });

  it('leaves optional slots empty instead of bringing back turned-down garments', () => {
    const cardigan = garment('cardigan', ['over']);
    const open = openSlotsFor(input([shorts, tee, cardigan], ['cardigan']), []);

    const over = slotNamed(open, 'over');
    expect(over?.turnedDownOnly).toBeFalse();
    expect(over?.candidates).toEqual([]);
  });
});
