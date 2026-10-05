import { Schema } from 'effect';

import { isLocalDate, type LocalDate } from './local-date.ts';

/** Decodes untrusted input into the branded calendar day the rest of the app uses. */
export const LocalDateSchema: Schema.Codec<LocalDate, string> =
  Schema.String.pipe(
    Schema.refine(isLocalDate, {
      message: 'expected a calendar day as YYYY-MM-DD',
    }),
  );
