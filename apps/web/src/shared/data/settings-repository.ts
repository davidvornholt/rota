import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { LocationSchema } from '#/shared/weather/open-meteo.ts';
import { readError, writeError } from './errors/data-errors.ts';

export const SettingsSchema = Schema.Struct({
  location: Schema.NullOr(LocationSchema),
  cleanTopAnchor: Schema.NullOr(LocalDateSchema),
  laundryDays: Schema.Number,
  cooldownDays: Schema.Number,
  categoryBudgets: Schema.Record({ key: Schema.String, value: Schema.Number }),
  proposalHour: Schema.Number,
});
export type Settings = Schema.Schema.Type<typeof SettingsSchema>;

const SettingsFromRow = Schema.Struct({
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

const decodeSettings = Schema.decodeUnknown(Schema.Array(SettingsFromRow));
const readSettings = readError('The settings');
const writeSettings = writeError('The settings');

export class SettingsRepository extends Effect.Service<SettingsRepository>()(
  'shared/SettingsRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      /** The settings row, or the defaults until the first save creates it. */
      const read = () =>
        sql`
          select location, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour
          from settings where id = 'singleton'
        `.pipe(
          Effect.flatMap(decodeSettings),
          Effect.map((rows): Settings => rows[0] ?? defaultSettings),
          Effect.mapError(readSettings),
        );

      const save = (settings: Settings) =>
        sql`
          insert into settings (id, location, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour)
          values ('singleton',
                  ${settings.location === null ? null : JSON.stringify(settings.location)}::jsonb,
                  ${settings.laundryDays},
                  ${settings.cleanTopAnchor},
                  ${settings.cooldownDays},
                  ${JSON.stringify(settings.categoryBudgets)}::jsonb,
                  ${settings.proposalHour})
          on conflict (id) do update
            set location = excluded.location,
                clean_top_anchor = excluded.clean_top_anchor,
                laundry_days = excluded.laundry_days,
                cooldown_days = excluded.cooldown_days,
                category_budgets = excluded.category_budgets,
                proposal_hour = excluded.proposal_hour,
                updated_at = now()
        `.pipe(Effect.asVoid, Effect.mapError(writeSettings));

      return { read, save };
    }),
  },
) {}
