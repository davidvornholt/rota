import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import type { LocalDate } from '#/shared/time/local-date.ts';
import { readError, writeError } from './errors/data-errors.ts';

const NoteRow = Schema.Struct({ occasion: Schema.String });
const decodeNotes = Schema.decodeUnknown(Schema.Array(NoteRow));
const readNote = readError('The day note');
const writeNote = writeError('The day note');

export class DayNoteRepository extends Effect.Service<DayNoteRepository>()(
  'shared/DayNoteRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const read = (date: LocalDate) =>
        sql`select occasion from day_note where for_date = ${date}`.pipe(
          Effect.flatMap(decodeNotes),
          Effect.map((rows) => rows[0]?.occasion ?? null),
          Effect.mapError(readNote),
        );

      /** An empty note removes the row: no occasion is the absence of a note. */
      const save = (date: LocalDate, occasion: string) => {
        const trimmed = occasion.trim();
        const statement =
          trimmed === ''
            ? sql`delete from day_note where for_date = ${date}`
            : sql`
                insert into day_note (for_date, occasion) values (${date}, ${trimmed})
                on conflict (for_date) do update
                  set occasion = excluded.occasion, updated_at = now()
              `;
        return statement.pipe(Effect.asVoid, Effect.mapError(writeNote));
      };

      return { read, save };
    }),
  },
) {}
