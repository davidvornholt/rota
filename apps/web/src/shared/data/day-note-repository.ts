import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';

import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { readError, writeError } from './errors/data-errors.ts';

const NoteRow = Schema.Struct({ occasion: Schema.String });
const decodeNotes = Schema.decodeUnknown(Schema.Array(NoteRow));
const DatedNoteRow = Schema.Struct({
  date: Schema.propertySignature(LocalDateSchema).pipe(
    Schema.fromKey('for_date'),
  ),
  occasion: Schema.String,
});
export type DayNote = Schema.Schema.Type<typeof DatedNoteRow>;
const decodeDatedNotes = Schema.decodeUnknown(Schema.Array(DatedNoteRow));
const readNote = readError('The day note');
const writeNote = writeError('The day note');

export class DayNoteRepository extends Effect.Service<DayNoteRepository>()(
  'shared/DayNoteRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      const read = (date: LocalDate) =>
        sql`select occasion from day_note where owner_id = ${owner.id} and for_date = ${date}`.pipe(
          Effect.flatMap(decodeNotes),
          Effect.map((rows) => rows[0]?.occasion ?? null),
          Effect.mapError(readNote),
        );

      /** The notes of a run of days, oldest first; days without one are simply absent. */
      const readRange = (from: LocalDate, to: LocalDate) =>
        sql`
          select for_date, occasion from day_note
          where owner_id = ${owner.id} and for_date between ${from} and ${to}
          order by for_date
        `.pipe(Effect.flatMap(decodeDatedNotes), Effect.mapError(readNote));

      /** An empty note removes the row: no occasion is the absence of a note. */
      const save = (date: LocalDate, occasion: string) => {
        const trimmed = occasion.trim();
        const statement =
          trimmed === ''
            ? sql`delete from day_note where owner_id = ${owner.id} and for_date = ${date}`
            : sql`
                insert into day_note (owner_id, for_date, occasion) values (${owner.id}, ${date}, ${trimmed})
                on conflict (owner_id, for_date) do update
                  set occasion = excluded.occasion, updated_at = now()
              `;
        return statement.pipe(Effect.asVoid, Effect.mapError(writeNote));
      };

      return { read, readRange, save };
    }),
  },
) {}
