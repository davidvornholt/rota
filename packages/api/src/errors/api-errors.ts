import { Schema } from 'effect';

/**
 * The failures a client can act on. Each message is written for the person
 * using the client, so a client may show it as it is.
 */

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  'Unauthorized',
  { message: Schema.String },
  { httpApiStatus: 401 },
) {}

export class NotFound extends Schema.TaggedError<NotFound>()(
  'NotFound',
  { message: Schema.String },
  { httpApiStatus: 404 },
) {}

/** The request was understood but breaks one of the wardrobe's rules. */
export class Rejected extends Schema.TaggedError<Rejected>()(
  'Rejected',
  { message: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Anything unexpected. The details stay in the server's log. */
export class ServerError extends Schema.TaggedError<ServerError>()(
  'ServerError',
  { message: Schema.String },
  { httpApiStatus: 500 },
) {}

export const failures = [NotFound, Rejected, ServerError] as const;
export type Failure = NotFound | Rejected | ServerError;
