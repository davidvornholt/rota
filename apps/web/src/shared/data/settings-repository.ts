import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { readError, writeError } from './errors/data-errors.ts';
import { defaultSettings, type Settings, SettingsFromRow } from './settings.ts';

const decodeSettings = Schema.decodeUnknown(Schema.Array(SettingsFromRow));
const readSettings = readError('The settings');
const writeSettings = writeError('The settings');

export class SettingsRepository extends Effect.Service<SettingsRepository>()(
  'shared/SettingsRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      /** The settings row, or the defaults until the first save creates it. */
      const read = () =>
        sql`
          select location, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour
          from settings where owner_id = ${owner.id}
        `.pipe(
          Effect.flatMap(decodeSettings),
          Effect.map((rows): Settings => rows[0] ?? defaultSettings),
          Effect.mapError(readSettings),
        );

      const save = (settings: Settings) =>
        sql`
          insert into settings (id, owner_id, location, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour)
          values (${owner.id}, ${owner.id},
                  ${settings.location === null ? null : JSON.stringify(settings.location)}::jsonb,
                  ${settings.laundryDays},
                  ${settings.cleanTopAnchor},
                  ${settings.cooldownDays},
                  ${JSON.stringify(settings.categoryBudgets)}::jsonb,
                  ${settings.proposalHour})
          on conflict (owner_id) do update
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
