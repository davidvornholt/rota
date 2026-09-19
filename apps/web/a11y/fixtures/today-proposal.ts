import type {
  TodayView,
  UnloggedGap,
} from '#/features/rota/schemas/today-view.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';

export const shirt: GarmentView = {
  id: 'demo-shirt',
  status: 'active',
  name: 'Blue Oxford shirt',
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
  material: 'Cotton',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'original',
  processingError: null,
  washedOn: null,
  washedAfterWear: false,
  inLaundry: false,
  wearsSinceWash: 0,
  studioError: null,
  studioState: { status: 'idle' },
  image: undefined,
  original: undefined,
  studio: undefined,
  wears: 1,
  lastWornOn: localDate('2026-09-06'),
  daysSinceWorn: 1,
  costPerWear: null,
};

export const demoProposal: TodayView = {
  today: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  weather: null,
  tomorrowWeather: null,
  forecastStale: false,
  occasion: null,
  worn: null,
  unlogged: null,
  tomorrowHint: null,
  problem: null,
  activeGarments: 2,
  proposal: {
    id: 'demo-outfit',
    status: 'pending',
    headline: 'Chinos and a shirt for today.',
    forecastStale: false,
    occasion: null,
    items: [
      {
        slot: 'bottom',
        garment: {
          ...shirt,
          id: 'demo-chinos',
          name: 'Navy chinos',
          category: 'trousers',
          slots: ['bottom'],
          effectiveBudget: 4,
        },
        continued: true,
        dayOfBudget: 2,
        budget: 4,
        reason: 'Still suitable for today.',
      },
      {
        slot: 'top',
        garment: shirt,
        continued: false,
        dayOfBudget: 1,
        budget: 2,
        reason: 'A fresh shirt.',
      },
    ],
  },
};

/** Three mornings went by unlogged after Thursday 3 September. */
export const threeDayGap: UnloggedGap = {
  from: localDate('2026-09-04'),
  to: localDate('2026-09-06'),
  count: 3,
  lastLogged: localDate('2026-09-03'),
  lastNames: ['Navy chinos', 'Blue Oxford shirt'],
};

export const oneDayGap: UnloggedGap = {
  from: localDate('2026-09-06'),
  to: localDate('2026-09-06'),
  count: 1,
  lastLogged: localDate('2026-09-05'),
  lastNames: ['Navy chinos', 'Blue Oxford shirt'],
};

export let fixtureProposal: TodayView | undefined;
export const setFixtureProposal = (view: TodayView) => {
  fixtureProposal = view;
};
