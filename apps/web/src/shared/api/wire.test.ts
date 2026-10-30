import { describe, expect, it } from 'bun:test';
import { GarmentSchema, slots, WeatherSchema } from '@rota/api/wardrobe';
import { Schema } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import { slotOrder } from '#/shared/data/garment-types.ts';
import { toGarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { outfitItems, toApiGarment, toApiWeather } from './wire.ts';

const garmentId = '0f8fad5b-d9cb-469f-a165-70867728950e';

const shirt: Garment = {
  id: garmentId,
  status: 'active',
  name: 'Blue oxford shirt',
  category: 'shirt',
  subcategory: 'oxford',
  slots: ['top'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  colors: [],
  pattern: '',
  material: 'cotton',
  fit: '',
  sleeve: 'long',
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
  images: {
    original: {
      key: 'photo.jpg',
      mime: 'image/jpeg',
      width: 900,
      height: 1200,
    },
    studio: { key: 'studio.png', mime: 'image/png', width: 1024, height: 1024 },
  },
};

const view = toGarmentView({
  garment: shirt,
  studioProgress: undefined,
  facts: undefined,
  categoryBudgets: { shirt: 2 },
  laundryDays: 2,
  today: localDate('2026-10-31'),
  urlFor: (key) => `/api/media/${key}`,
});

describe('the API wire mapping', () => {
  it('lists the slots the app knows, in its order', () => {
    expect([...slots]).toEqual([...slotOrder]);
  });

  it('maps a garment onto the wire contract', () => {
    const garment = toApiGarment(view);
    expect(Schema.is(GarmentSchema)(garment)).toBe(true);
    expect(garment.wearBudget).toBe(2);
    expect(garment.picture?.url).toBe('/api/media/studio.png');
    expect(garment.photo).toEqual({
      url: '/api/media/photo.jpg',
      width: 900,
      height: 1200,
    });
  });

  it('describes the weather in words', () => {
    const weather = toApiWeather({
      date: localDate('2026-10-31'),
      issuedOn: localDate('2026-10-31'),
      locationLabel: 'Berlin',
      high: 9.199_999_809_265_137,
      low: 7.099_999_904_632_568,
      precipitationProbability: 5,
      precipitationMm: 0.300_000_011_920_929,
      windKmh: 8.199_999_809_265_137,
      weatherCode: 1,
    });
    expect(Schema.is(WeatherSchema)(weather)).toBe(true);
    expect(weather.location).toBe('Berlin');
    expect([
      weather.highC,
      weather.lowC,
      weather.precipitationMm,
      weather.windKmh,
    ]).toEqual([9.2, 7.1, 0.3, 8.2]);
  });

  it('names a garment the wardrobe no longer has', () => {
    expect(outfitItems([{ slot: 'top', garmentId }], new Map())[0]?.name).toBe(
      'Unknown garment',
    );
  });
});
