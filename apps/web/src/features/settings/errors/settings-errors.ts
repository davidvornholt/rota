import { Schema } from 'effect';

const badRequest = 400;

/** Settings that break the rules of the settings form; the message names the field and the rule. */
export class InvalidSettings extends Schema.TaggedError<InvalidSettings>()(
  'InvalidSettings',
  { message: Schema.String, httpStatus: Schema.Literal(badRequest) },
) {
  constructor(reason: string) {
    super({ message: `Invalid settings: ${reason}`, httpStatus: badRequest });
  }
}
