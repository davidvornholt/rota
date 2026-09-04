import { isCategory } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';

/** The editable fields of a garment, as the form holds them, lifted from a view. */
export const editOf = (garment: GarmentView): GarmentEdit => ({
  name: garment.name,
  category: isCategory(garment.category) ? garment.category : 'shirt',
  subcategory: garment.subcategory,
  slots: garment.slots,
  warmth: garment.warmth,
  rainOk: garment.rainOk,
  formality: garment.formality,
  wearBudget: garment.wearBudget,
  colors: garment.colors,
  pattern: garment.pattern,
  material: garment.material,
  fit: garment.fit,
  sleeve: garment.sleeve,
  brand: garment.brand,
  seasons: garment.seasons,
  notes: garment.notes,
  price: garment.price,
  purchasedOn: garment.purchasedOn,
});

/** Adds or removes one entry, keeping the rest in order. */
export const toggled = <T extends string>(
  list: ReadonlyArray<T>,
  item: T,
): ReadonlyArray<T> =>
  list.includes(item)
    ? list.filter((entry) => entry !== item)
    : [...list, item];
