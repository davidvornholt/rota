import type { GarmentChanges } from '@rota/api/api';
import { Effect, Schema } from 'effect';

import type { Garment } from '#/shared/data/garment.ts';
import { InvalidGarmentEdit } from '../errors/garment-errors.ts';
import { GarmentEditSchema } from '../schemas/garment-input.ts';

/** The editable fields as stored, for the form's rules to check again. */
export const storedFields = (garment: Garment) => ({
  name: garment.name,
  category: garment.category,
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
  notes: garment.notes,
  price: garment.price,
  purchasedOn: garment.purchasedOn,
});

export const checkedEdit = (fields: unknown) =>
  Schema.decodeUnknownEffect(GarmentEditSchema)(fields).pipe(
    Effect.mapError((error) => new InvalidGarmentEdit(error.message)),
  );

/** A client's changes over the stored fields, checked by the form's rules. */
export const changedEdit = (garment: Garment, changes: GarmentChanges) => {
  const { colors, ...rest } = changes;
  return checkedEdit({
    ...storedFields(garment),
    ...rest,
    ...(colors === undefined ? {} : { colors: colors.map((hex) => ({ hex })) }),
  });
};
