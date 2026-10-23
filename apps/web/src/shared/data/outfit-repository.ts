import { PgTypes } from '@effect/sql-pg';
import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
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

// The driver cannot infer an element type from an empty array, so the
// parameter states it.
const textArray = (values: ReadonlyArray<string>) =>
  Effect.fromResult(PgTypes.array(values, PgTypes.OID.text));

export class OutfitRepository extends Context.Service<OutfitRepository>()(
  'shared/OutfitRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;
      const list = () =>
        sql`select id, name, entries, collections, favourite from saved_outfit where owner_id = ${owner.id} order by updated_at desc`.pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(Schema.Array(SavedOutfitSchema)),
          ),
          Effect.mapError(read),
        );
      // An edit keeps the outfit's favourite mark: only `setFavourite` changes it.
      const save = (outfit: SavedOutfit) =>
        textArray(outfit.collections).pipe(
          Effect.flatMap(
            (collections) => sql`
      insert into saved_outfit (owner_id, id, name, entries, collections, favourite) values (${owner.id}, ${outfit.id}, ${outfit.name}, ${JSON.stringify(outfit.entries)}::jsonb, ${collections}, ${outfit.favourite})
      on conflict (id) do update set name = excluded.name, entries = excluded.entries, collections = excluded.collections, updated_at = now() where saved_outfit.owner_id = ${owner.id}
    `,
          ),
          Effect.asVoid,
          Effect.mapError(write),
        );
      // Unlike an edit, regrouping does not move the outfit up the list.
      const setCollections = (id: string, collections: ReadonlyArray<string>) =>
        textArray(collections).pipe(
          Effect.flatMap(
            (parameter) => sql`
      update saved_outfit set collections = ${parameter} where owner_id = ${owner.id} and id = ${id}
    `,
          ),
          Effect.asVoid,
          Effect.mapError(write),
        );
      // Like regrouping, marking a favourite keeps the outfit's place in the list.
      const setFavourite = (id: string, favourite: boolean) =>
        sql`
      update saved_outfit set favourite = ${favourite} where owner_id = ${owner.id} and id = ${id}
    `.pipe(Effect.asVoid, Effect.mapError(write));
      // Serializes the owner's saved-outfit changes until the caller's
      // transaction ends; outside a transaction it is released at once.
      const lock = () =>
        sql`select pg_advisory_xact_lock(hashtextextended('rota:saved-outfit:' || ${owner.id}::text, 0))`.pipe(
          Effect.asVoid,
          Effect.mapError(write),
        );
      const remove = (id: string) =>
        sql`delete from saved_outfit where id = ${id} and owner_id = ${owner.id}`.pipe(
          Effect.asVoid,
          Effect.mapError(write),
        );
      const plan = (date: LocalDate) =>
        sql`select entries, clean_top, based_on, forecast from day_plan where owner_id = ${owner.id} and for_date = ${date}`.pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(PlanSchema))),
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
      return {
        list,
        lock,
        save,
        remove,
        setCollections,
        setFavourite,
        plan,
        savePlan,
        setCleanTop,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(OutfitRepository, OutfitRepository.make);
}
