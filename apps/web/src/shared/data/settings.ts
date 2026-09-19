import { Schema } from 'effect';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { LocationSchema } from '#/shared/weather/open-meteo.ts';

export const SettingsSchema = Schema.Struct({
  location: Schema.NullOr(LocationSchema),
  cleanTopAnchor: Schema.NullOr(LocalDateSchema),
  laundryDays: Schema.Number,
  cooldownDays: Schema.Number,
  categoryBudgets: Schema.Record({ key: Schema.String, value: Schema.Number }),
  proposalHour: Schema.Number,
});
export type Settings = Schema.Schema.Type<typeof SettingsSchema>;

export const SettingsFromRow = Schema.Struct({
  laundryDays: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('laundry_days'),
  ),
  location: Schema.NullOr(LocationSchema),
  cleanTopAnchor: Schema.propertySignature(Schema.NullOr(LocalDateSchema)).pipe(
    Schema.fromKey('clean_top_anchor'),
  ),
  cooldownDays: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('cooldown_days'),
  ),
  categoryBudgets: Schema.propertySignature(
    Schema.Record({ key: Schema.String, value: Schema.Number }),
  ).pipe(Schema.fromKey('category_budgets')),
  proposalHour: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('proposal_hour'),
  ),
});

export const defaultSettings: Settings = {
  location: null,
  cleanTopAnchor: null,
  laundryDays: 4,
  cooldownDays: 7,
  categoryBudgets: {},
  proposalHour: 5,
};
