import { expect, it } from 'bun:test';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { continuations, type RotationInput } from '../rotation.ts';
import { slotChoicesFor } from './proposal-assembly.ts';
import { buildProposalPrompt } from './proposal-prompt.ts';

const garment = (id: string, slots: ReadonlyArray<Slot>): Garment => ({
  id,
  status: 'active',
  name: id,
  category: slots[0] === 'bottom' ? 'trousers' : 'shirt',
  subcategory: '',
  slots,
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: 4,
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

const mild: WeatherDay = {
  date: localDate('2026-09-07'),
  issuedOn: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  high: 14,
  low: 8,
  precipitationProbability: 5,
  precipitationMm: 0,
  windKmh: 8,
  weatherCode: 1,
};

const worn = (date: string, garmentId: string, slot: Slot): WearEntry => ({
  wornOn: localDate(date),
  garmentId,
  slot,
  source: 'proposed',
});

it('says how many wears each garment has left, so a last wear does not read as the limit', () => {
  const grey = garment('grey', ['bottom']);
  const jeans = garment('jeans', ['bottom']);
  const cream = garment('cream', ['bottom']);
  const tee = garment('tee', ['top']);
  const rotation: RotationInput = {
    cleanTop: false,
    today: localDate('2026-09-07'),
    log: [
      worn('2026-08-20', 'jeans', 'bottom'),
      worn('2026-09-04', 'grey', 'bottom'),
      worn('2026-09-05', 'grey', 'bottom'),
      worn('2026-09-06', 'grey', 'bottom'),
    ],
    garments: [grey, jeans, cream, tee],
    settings: { laundryDays: 4, cooldownDays: 3, categoryBudgets: {} },
    excluded: new Set(),
  };
  const continuing = continuations(rotation);
  const lines = buildProposalPrompt({
    cleanTop: false,
    today: rotation.today,
    weather: mild,
    yesterday: undefined,
    upcoming: [],
    forecastStale: false,
    occasion: null,
    continuations: continuing,
    slotChoices: slotChoicesFor(rotation, continuing, []),
    recent: [],
    imageFor: () => undefined,
  }).parts.flatMap((part) => ('text' in part ? [part.text] : []));
  const line = (name: string) =>
    lines.find((text) => text.includes(`— ${name}: `));
  expect(line('grey')).toStartWith('C1 (bottom)');
  expect(line('grey')).toEndWith(
    '; worn 3 of 4 times since washing, 1 wear left.',
  );
  expect(line('jeans')).toContain(
    '; worn 1 of 4 times since washing, 3 wears left',
  );
  expect(line('cream')).toContain(
    '; worn 0 of 4 times since washing, 4 wears left',
  );
});
