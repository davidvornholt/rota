import { Schema } from 'effect';

// The command's own arguments are wrong, before anything reaches Rota.
export class InvalidInput extends Schema.TaggedError<InvalidInput>()(
  'InvalidInput',
  { message: Schema.String },
) {}

// No session for this server, or Rota no longer accepts it.
export class NotSignedIn extends Schema.TaggedError<NotSignedIn>()(
  'NotSignedIn',
  { message: Schema.String },
) {}

// Nothing answered: the machine is offline or the server is down.
export class ServerUnreachable extends Schema.TaggedError<ServerUnreachable>()(
  'ServerUnreachable',
  { message: Schema.String },
) {}

// Rota answered with something this CLI does not understand, usually because
// one of them is older than the other.
export class UnexpectedResponse extends Schema.TaggedError<UnexpectedResponse>()(
  'UnexpectedResponse',
  { message: Schema.String },
) {}

// The sessions file exists but cannot be read or written.
export class SessionStoreFailed extends Schema.TaggedError<SessionStoreFailed>()(
  'SessionStoreFailed',
  { message: Schema.String },
) {}

// The sign-in was denied in the browser or its code ran out.
export class LoginFailed extends Schema.TaggedError<LoginFailed>()(
  'LoginFailed',
  { message: Schema.String },
) {}

// A picture could not be saved to the cache directory.
export class PictureNotSaved extends Schema.TaggedError<PictureNotSaved>()(
  'PictureNotSaved',
  { message: Schema.String },
) {}
