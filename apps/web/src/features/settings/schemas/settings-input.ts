import { Schema } from 'effect';

import {
  garmentCategories,
  longestWearBudget,
} from '#/shared/data/garment-types.ts';
import { LocationSchema } from '#/shared/weather/open-meteo.ts';

const shortestQuery = 2;
const longestQuery = 80;
const longestCooldown = 60;
const lastHour = 23;

export const LocationQuerySchema = Schema.Struct({
  query: Schema.String.pipe(
    Schema.minLength(shortestQuery),
    Schema.maxLength(longestQuery),
  ),
});

export const SaveLocationInputSchema = Schema.Struct({
  location: LocationSchema,
});

const budgetDay = Schema.Int.pipe(Schema.between(1, longestWearBudget));

export const RotationSettingsInputSchema = Schema.Struct({
  cooldownDays: Schema.Int.pipe(Schema.between(0, longestCooldown)),
  proposalHour: Schema.Int.pipe(Schema.between(0, lastHour)),
  categoryBudgets: Schema.Record({
    key: Schema.Literal(...garmentCategories),
    value: budgetDay,
  }),
});

export type RotationSettingsInput = Schema.Schema.Type<
  typeof RotationSettingsInputSchema
>;

export const decodeLocationQuery =
  Schema.decodeUnknownSync(LocationQuerySchema);
export const decodeSaveLocationInput = Schema.decodeUnknownSync(
  SaveLocationInputSchema,
);
export const decodeRotationSettingsInput = Schema.decodeUnknownSync(
  RotationSettingsInputSchema,
);
