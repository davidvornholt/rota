import { Schema } from 'effect';
export class IdentityRequired extends Schema.TaggedError<IdentityRequired>()(
  'IdentityRequired',
  { message: Schema.String },
) {}
