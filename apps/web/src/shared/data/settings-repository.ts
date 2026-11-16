import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import type { Location } from '#/shared/weather/location.ts';
import { readError, writeError } from './errors/data-errors.ts';
import { staleEdit } from './errors/stale-edit.ts';
import {
  defaultSettings,
  type RotationSettings,
  type Settings,
  SettingsFromRow,
} from './settings.ts';

const decodeSettings = Schema.decodeUnknownEffect(
  Schema.Array(SettingsFromRow),
);
const readSettings = readError('The settings');
const writeSettings = writeError('The settings');

export class SettingsRepository extends Context.Service<SettingsRepository>()(
  'shared/SettingsRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      /** The settings row, or the defaults until the first save creates it. */
      const read = () =>
        sql`
          select location, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour, revision
          from settings where owner_id = ${owner.id}
        `.pipe(
          Effect.flatMap(decodeSettings),
          Effect.map((rows): Settings => rows[0] ?? defaultSettings),
          Effect.mapError(readSettings),
        );

      /** Sets the place alone, so it never touches what the rotation form saved. */
      const saveLocation = (location: Location) =>
        sql`
          insert into settings (id, owner_id, location)
          values (${owner.id}, ${owner.id}, ${JSON.stringify(location)}::jsonb)
          on conflict (owner_id) do update
            set location = excluded.location, updated_at = now()
        `.pipe(Effect.asVoid, Effect.mapError(writeSettings));

      /**
       * Saves the rotation form that loaded `revision`; no row yet is revision
       * 0. The write counts only while the settings are still at that revision,
       * so a form that is out of date is refused and never undoes another save.
       */
      const saveRotation = (rotation: RotationSettings, revision: number) => {
        const fields = {
          laundryDays: rotation.laundryDays,
          cleanTopAnchor: rotation.cleanTopAnchor,
          cooldownDays: rotation.cooldownDays,
          categoryBudgets: JSON.stringify(rotation.categoryBudgets),
          proposalHour: rotation.proposalHour,
        };
        // Revision 0 is also a row that only has a place, or one from before
        // revisions. Its first rotation save counts once, the next at 0 is stale.
        const write =
          revision === 0
            ? sql<{ readonly revision: number }>`
                insert into settings (id, owner_id, laundry_days, clean_top_anchor, cooldown_days, category_budgets, proposal_hour, revision)
                values (${owner.id}, ${owner.id}, ${fields.laundryDays}, ${fields.cleanTopAnchor}, ${fields.cooldownDays}, ${fields.categoryBudgets}::jsonb, ${fields.proposalHour}, 1)
                on conflict (owner_id) do update
                  set laundry_days = excluded.laundry_days,
                      clean_top_anchor = excluded.clean_top_anchor,
                      cooldown_days = excluded.cooldown_days,
                      category_budgets = excluded.category_budgets,
                      proposal_hour = excluded.proposal_hour,
                      revision = 1,
                      updated_at = now()
                  where settings.revision = 0
                returning revision
              `
            : sql<{ readonly revision: number }>`
                update settings
                set laundry_days = ${fields.laundryDays},
                    clean_top_anchor = ${fields.cleanTopAnchor},
                    cooldown_days = ${fields.cooldownDays},
                    category_budgets = ${fields.categoryBudgets}::jsonb,
                    proposal_hour = ${fields.proposalHour},
                    revision = revision + 1,
                    updated_at = now()
                where owner_id = ${owner.id} and revision = ${revision}
                returning revision
              `;
        return write.pipe(
          Effect.mapError(writeSettings),
          Effect.flatMap((rows) =>
            rows.length > 0 ? Effect.void : Effect.fail(staleEdit()),
          ),
        );
      };

      return { read, saveLocation, saveRotation };
    }),
  },
) {
  static readonly layer = Layer.effect(
    SettingsRepository,
    SettingsRepository.make,
  );
}
