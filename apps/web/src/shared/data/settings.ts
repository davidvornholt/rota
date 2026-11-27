import { Schema } from 'effect';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { LocationSchema } from '#/shared/weather/open-meteo.ts';

export const SettingsSchema = Schema.Struct({
  location: Schema.NullOr(LocationSchema),
  cleanTopAnchor: Schema.NullOr(LocalDateSchema),
  laundryDays: Schema.Number,
  cooldownDays: Schema.Number,
  categoryBudgets: Schema.Record(Schema.String, Schema.Number),
  proposalHour: Schema.Number,
  styleNote: Schema.String,
  /** The version of the rotation fields; a save sends the one its form loaded. */
  revision: Schema.Int,
});
export type Settings = Schema.Schema.Type<typeof SettingsSchema>;

/** What the rotation form edits: every field but the place, which saves on its own. */
export type RotationSettings = Pick<
  Settings,
  | 'cleanTopAnchor'
  | 'laundryDays'
  | 'cooldownDays'
  | 'categoryBudgets'
  | 'proposalHour'
  | 'styleNote'
>;

export const SettingsFromRow = Schema.Struct({
  laundryDays: Schema.Number,
  location: Schema.NullOr(LocationSchema),
  cleanTopAnchor: Schema.NullOr(LocalDateSchema),
  cooldownDays: Schema.Number,
  categoryBudgets: Schema.Record(Schema.String, Schema.Number),
  proposalHour: Schema.Number,
  styleNote: Schema.String,
  revision: Schema.Int,
}).pipe(
  Schema.encodeKeys({
    laundryDays: 'laundry_days',
    cleanTopAnchor: 'clean_top_anchor',
    cooldownDays: 'cooldown_days',
    categoryBudgets: 'category_budgets',
    proposalHour: 'proposal_hour',
    styleNote: 'style_note',
  }),
);

export const defaultSettings: Settings = {
  location: null,
  cleanTopAnchor: null,
  laundryDays: 4,
  cooldownDays: 7,
  categoryBudgets: {},
  proposalHour: 5,
  styleNote: '',
  revision: 0,
};
