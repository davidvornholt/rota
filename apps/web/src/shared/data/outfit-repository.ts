import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { readError, writeError } from './errors/data-errors.ts';
import {
  type DayPlan,
  emptyPlan,
  PlanSchema,
  type SavedOutfit,
  SavedOutfitSchema,
} from './outfit.ts';

const read = readError('The outfits');
const write = writeError('The outfit');

export class OutfitRepository extends Effect.Service<OutfitRepository>()(
  'shared/OutfitRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;
      const list = () =>
        sql`select id, name, entries from saved_outfit where owner_id = ${owner.id} order by updated_at desc`.pipe(
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(SavedOutfitSchema))),
          Effect.mapError(read),
        );
      const save = (outfit: SavedOutfit) =>
        sql`
      insert into saved_outfit (owner_id, id, name, entries) values (${owner.id}, ${outfit.id}, ${outfit.name}, ${JSON.stringify(outfit.entries)}::jsonb)
      on conflict (id) do update set name = excluded.name, entries = excluded.entries, updated_at = now() where saved_outfit.owner_id = ${owner.id}
    `.pipe(Effect.asVoid, Effect.mapError(write));
      const remove = (id: string) =>
        sql`delete from saved_outfit where id = ${id} and owner_id = ${owner.id}`.pipe(
          Effect.asVoid,
          Effect.mapError(write),
        );
      const plan = (date: LocalDate) =>
        sql`select entries, clean_top, based_on, forecast from day_plan where owner_id = ${owner.id} and for_date = ${date}`.pipe(
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(PlanSchema))),
          Effect.map((rows) => rows[0] ?? emptyPlan),
          Effect.mapError(read),
        );
      const savePlan = (
        date: LocalDate,
        value: Pick<DayPlan, 'entries' | 'basedOn' | 'forecast'>,
      ) =>
        sql`
      insert into day_plan (owner_id, for_date, entries, based_on, forecast)
      values (${owner.id}, ${date}, ${value.entries === null ? null : JSON.stringify(value.entries)}::jsonb, ${value.basedOn}, ${value.forecast === null ? null : JSON.stringify(value.forecast)}::jsonb)
      on conflict (owner_id, for_date) do update set entries = excluded.entries, based_on = excluded.based_on, forecast = excluded.forecast, updated_at = now()
    `.pipe(Effect.asVoid, Effect.mapError(write));
      const setCleanTop = (date: LocalDate, value: boolean) =>
        sql`
      insert into day_plan (owner_id, for_date, clean_top) values (${owner.id}, ${date}, ${value})
      on conflict (owner_id, for_date) do update set clean_top = excluded.clean_top, updated_at = now()
    `.pipe(Effect.asVoid, Effect.mapError(write));
      return { list, save, remove, plan, savePlan, setCleanTop };
    }),
  },
) {}
