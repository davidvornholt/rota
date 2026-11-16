import { Schema } from 'effect';

const conflictStatus = 409;

/** What the browser shows when a save was refused; the screen matches it to offer a reload. */
export const staleEditMessage =
  'A newer version of this was saved in another tab or on another device, so your change was not saved. Reload to see the latest version, then make your change again.';

/** Named so the browser can hear it: the form was loaded before another save changed the record. */
export class StaleEditError extends Schema.TaggedError<StaleEditError>()(
  'StaleEditError',
  { message: Schema.String, httpStatus: Schema.Literal(conflictStatus) },
) {}

export const staleEdit = (): StaleEditError =>
  new StaleEditError({ message: staleEditMessage, httpStatus: conflictStatus });
