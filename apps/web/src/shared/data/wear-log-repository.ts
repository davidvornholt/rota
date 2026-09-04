import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { readError, writeError } from './errors/data-errors.ts';
import { SlotSchema } from './garment.ts';
import type { Slot } from './garment-types.ts';

export const WearSourceSchema = Schema.Literal(
  'proposed',
  'override',
  'backfill',
  'edited',
);
export type WearSource = Schema.Schema.Type<typeof WearSourceSchema>;

export const WearEntryFromRow = Schema.Struct({
  wornOn: Schema.propertySignature(LocalDateSchema).pipe(
    Schema.fromKey('worn_on'),
  ),
  garmentId: Schema.propertySignature(Schema.UUID).pipe(
    Schema.fromKey('garment_id'),
  ),
  slot: SlotSchema,
  source: WearSourceSchema,
});

export type WearEntry = Schema.Schema.Type<typeof WearEntryFromRow>;

export type OutfitEntry = {
  readonly garmentId: string;
  readonly slot: Slot;
};

const decodeEntries = Schema.decodeUnknown(Schema.Array(WearEntryFromRow));
const readLog = readError('The wear log');
const writeLog = writeError('The wear log');

export class WearLogRepository extends Effect.Service<WearLogRepository>()(
  'shared/WearLogRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const listBetween = (from: LocalDate, to: LocalDate) =>
        sql`
          select worn_on, garment_id, slot, source
          from wear_log
          where worn_on between ${from} and ${to}
          order by worn_on, slot
        `.pipe(Effect.flatMap(decodeEntries), Effect.mapError(readLog));

      const readDay = (date: LocalDate) => listBetween(date, date);

      /** Everything ever logged, oldest first. The statistics read this once. */
      const history = () =>
        sql`
          select worn_on, garment_id, slot, source
          from wear_log
          order by worn_on, slot
        `.pipe(Effect.flatMap(decodeEntries), Effect.mapError(readLog));

      /**
       * A day is written whole: what was there is removed and the given outfit
       * takes its place, in one transaction, so a correction can never leave a
       * day with yesterday's top and today's trousers.
       */
      const replaceDay = (
        date: LocalDate,
        entries: ReadonlyArray<OutfitEntry>,
        source: WearSource,
      ) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`delete from wear_log where worn_on = ${date}`;
              for (const entry of entries) {
                yield* sql`
                  insert into wear_log (worn_on, garment_id, slot, source)
                  values (${date}, ${entry.garmentId}, ${entry.slot}, ${source})
                `;
              }
            }),
          )
          .pipe(Effect.asVoid, Effect.mapError(writeLog));

      return { listBetween, readDay, history, replaceDay };
    }),
  },
) {}
