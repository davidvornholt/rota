import type { Garment, OutfitItem, Weather } from '@rota/api/wardrobe';
import type {
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { forecastHoursLabel } from '#/shared/weather/forecast-window.ts';
import { weatherWords } from '#/shared/weather/weather-words.ts';

/** The app's views mapped onto the API's wire shapes. */

const picture = (image: GarmentImageView | undefined) =>
  image === undefined
    ? null
    : { url: image.url, width: image.width, height: image.height };

export const toApiGarment = (view: GarmentView): Garment => ({
  id: view.id,
  name: view.name,
  status: view.status,
  category: view.category,
  subcategory: view.subcategory,
  slots: view.slots,
  colors: view.colors.map((color) => color.hex),
  pattern: view.pattern,
  material: view.material,
  fit: view.fit,
  sleeve: view.sleeve,
  brand: view.brand,
  notes: view.notes,
  warmth: view.warmth,
  formality: view.formality,
  rainOk: view.rainOk,
  wears: view.wears,
  lastWornOn: view.lastWornOn,
  wearBudget: view.effectiveBudget,
  wearsSinceWash: view.wearsSinceWash,
  inLaundry: view.inLaundry,
  readyOn: view.readyOn,
  price: view.price,
  purchasedOn: view.purchasedOn,
  costPerWear: view.costPerWear,
  picture: picture(view.image),
  photo: picture(view.original),
  studio: picture(view.studio),
});

/** The forecast is stored as 32-bit floats, so 9.2 reads back as 9.199999809. */
const tenths = (value: number) => Math.round(value * 10) / 10;

export const toApiWeather = (day: WeatherDay): Weather => ({
  date: day.date,
  location: day.locationLabel,
  hours: forecastHoursLabel,
  conditions: weatherWords(day.weatherCode),
  highC: tenths(day.high),
  lowC: tenths(day.low),
  precipitationProbability: Math.round(day.precipitationProbability),
  precipitationMm: tenths(day.precipitationMm),
  windKmh: tenths(day.windKmh),
});

const unknownGarment = 'Unknown garment';

/** Names each entry from the garments the caller already loaded. */
export const outfitItems = (
  entries: ReadonlyArray<{
    readonly slot: OutfitItem['slot'];
    readonly garmentId: string;
  }>,
  names: ReadonlyMap<string, string>,
): ReadonlyArray<OutfitItem> =>
  entries.map((entry) => ({
    slot: entry.slot,
    garmentId: entry.garmentId,
    name: names.get(entry.garmentId) ?? unknownGarment,
  }));
