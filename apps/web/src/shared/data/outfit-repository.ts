import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { readError, writeError } from './errors/data-errors.ts';
import { SlotSchema } from './garment.ts';
import { slotOrder } from './garment-types.ts';

export const OutfitEntriesSchema = Schema.Array(
  Schema.Struct({
    garmentId: Schema.UUID,
    slot: SlotSchema,
  }),
).pipe(Schema.maxItems(slotOrder.length));
export const ForecastSnapshotSchema = Schema.Struct({
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
});
export type ForecastSnapshot = Schema.Schema.Type<
  typeof ForecastSnapshotSchema
>;
export const SavedOutfitSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  entries: OutfitEntriesSchema,
});
export type SavedOutfit = Schema.Schema.Type<typeof SavedOutfitSchema>;
const PlanSchema = Schema.Struct({
  entries: Schema.NullOr(OutfitEntriesSchema),
  cleanTop: Schema.propertySignature(Schema.NullOr(Schema.Boolean)).pipe(
    Schema.fromKey('clean_top'),
  ),
  basedOn: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('based_on'),
  ),
  forecast: Schema.NullOr(ForecastSnapshotSchema),
});
export type DayPlan = Schema.Schema.Type<typeof PlanSchema>;
export const emptyPlan: DayPlan = {
  entries: null,
  cleanTop: null,
  basedOn: null,
  forecast: null,
};
const read = readError('The outfits');
const write = writeError('The outfit');

export class OutfitRepository extends Effect.Service<OutfitRepository>()(
  'shared/OutfitRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const list = () =>
        sql`select id, name, entries from saved_outfit order by updated_at desc`.pipe(
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(SavedOutfitSchema))),
          Effect.mapError(read),
        );
      const save = (outfit: SavedOutfit) =>
        sql`
      insert into saved_outfit (id, name, entries) values (${outfit.id}, ${outfit.name}, ${JSON.stringify(outfit.entries)}::jsonb)
      on conflict (id) do update set name = excluded.name, entries = excluded.entries, updated_at = now()
    `.pipe(Effect.asVoid, Effect.mapError(write));
      const remove = (id: string) =>
        sql`delete from saved_outfit where id = ${id}`.pipe(
          Effect.asVoid,
          Effect.mapError(write),
        );
      const plan = (date: LocalDate) =>
        sql`select entries, clean_top, based_on, forecast from day_plan where for_date = ${date}`.pipe(
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(PlanSchema))),
          Effect.map((rows) => rows[0] ?? emptyPlan),
          Effect.mapError(read),
        );
      const savePlan = (
        date: LocalDate,
        value: Pick<DayPlan, 'entries' | 'basedOn' | 'forecast'>,
      ) =>
        sql`
      insert into day_plan (for_date, entries, based_on, forecast)
      values (${date}, ${value.entries === null ? null : JSON.stringify(value.entries)}::jsonb, ${value.basedOn}, ${value.forecast === null ? null : JSON.stringify(value.forecast)}::jsonb)
      on conflict (for_date) do update set entries = excluded.entries, based_on = excluded.based_on, forecast = excluded.forecast, updated_at = now()
    `.pipe(Effect.asVoid, Effect.mapError(write));
      const setCleanTop = (date: LocalDate, value: boolean) =>
        sql`
      insert into day_plan (for_date, clean_top) values (${date}, ${value})
      on conflict (for_date) do update set clean_top = excluded.clean_top, updated_at = now()
    `.pipe(Effect.asVoid, Effect.mapError(write));
      return { list, save, remove, plan, savePlan, setCleanTop };
    }),
  },
) {}
