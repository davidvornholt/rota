import { expect, it } from 'bun:test';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { neglected } from './stats.ts';

const garment = (
  id: string,
  overrides: Partial<GarmentView> = {},
): GarmentView => ({
  id,
  status: 'active',
  name: id,
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  effectiveBudget: 2,
  colors: [{ hex: '#336699' }],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'original',
  processingError: null,
  studioError: null,
  studioState: { status: 'idle' },
  image: undefined,
  original: undefined,
  studio: undefined,
  wears: 0,
  lastWornOn: null,
  daysSinceWorn: null,
  costPerWear: null,
  ...overrides,
});

it('not worn recently includes active garments of any warmth at the 90-day boundary', () => {
  const light = garment('light', { warmth: 1, daysSinceWorn: 90 });
  const heavy = garment('heavy', { warmth: 3, daysSinceWorn: 120 });
  const neverWorn = garment('never-worn');
  const recentlyWorn = garment('recent', { daysSinceWorn: 89 });
  const wornToday = garment('today', { daysSinceWorn: 0 });
  const input = [light, recentlyWorn, neverWorn, heavy, wornToday];
  const original = [...input];

  expect(neglected(input)).toEqual([neverWorn, heavy, light]);
  expect(input).toEqual(original);
});

it('not worn recently excludes inactive garments even when never worn', () => {
  expect(
    neglected([
      garment('processing', { status: 'processing' }),
      garment('review', { status: 'review' }),
      garment('retired', { status: 'retired', daysSinceWorn: 200 }),
    ]),
  ).toEqual([]);
});
