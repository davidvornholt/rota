import type { DayView, Garment } from '@rota/api/wardrobe';

export const shirt = '11111111-1111-4111-8111-111111111111';
export const jeans = '22222222-2222-4222-8222-222222222222';
export const pictureKey =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg';

export const dayView: DayView = {
  date: '2026-10-31',
  today: '2026-10-30',
  weather: null,
  forecastStale: false,
  occasion: null,
  proposal: null,
  worn: null,
  plan: null,
  cleanTop: false,
  laundry: [],
  problem: null,
  warnings: [],
};

export const garment = (id: string, state: Garment['status']): Garment => ({
  id,
  name: `Garment ${id.slice(0, 2)}`,
  status: state,
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  warmth: 2,
  formality: 2,
  rainOk: true,
  wears: 0,
  lastWornOn: null,
  wearBudget: 2,
  wearsSinceWash: 0,
  inLaundry: false,
  readyOn: null,
  price: null,
  purchasedOn: null,
  costPerWear: null,
  picture: { url: `/api/media/${pictureKey}`, width: 800, height: 1000 },
  photo: null,
  studio: null,
});
