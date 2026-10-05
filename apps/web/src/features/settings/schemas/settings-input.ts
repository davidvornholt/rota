import { Schema } from 'effect';

import {
  garmentCategories,
  longestWearBudget,
} from '#/shared/data/garment-types.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { LocationSchema } from '#/shared/weather/open-meteo.ts';

const shortestQuery = 2;
const longestQuery = 80;
const longestCooldown = 60;
const lastHour = 23;
const longestLaundry = 30;

export const LocationQuerySchema = Schema.Struct({
  query: Schema.String.check(
    Schema.isMinLength(shortestQuery),
    Schema.isMaxLength(longestQuery),
  ),
});

export const SaveLocationInputSchema = Schema.Struct({
  location: LocationSchema,
});

const budgetDay = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: longestWearBudget }),
);

export const RotationSettingsInputSchema = Schema.Struct({
  cleanTopAnchor: Schema.NullOr(LocalDateSchema),
  laundryDays: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: longestLaundry }),
  ),
  cooldownDays: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: longestCooldown }),
  ),
  proposalHour: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: lastHour }),
  ),
  categoryBudgets: Schema.Record(Schema.Literals(garmentCategories), budgetDay),
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
