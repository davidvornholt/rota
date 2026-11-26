import { Schema } from 'effect';

const badRequest = 400;
const conflict = 409;
const contentTooLarge = 413;

/** An upload the app refuses before storing anything; the status tells the browser how to say so. */
export class UploadError extends Schema.TaggedError<UploadError>()(
  'UploadError',
  {
    message: Schema.String,
    httpStatus: Schema.Literals([badRequest, conflict, contentTooLarge]),
  },
) {}

/** A change the garment's state doesn't allow, such as accepting one still being read; the message says what to do instead. */
export class GarmentLifecycleError extends Schema.TaggedError<GarmentLifecycleError>()(
  'GarmentLifecycleError',
  { message: Schema.String, httpStatus: Schema.Literal(conflict) },
) {
  constructor(message: string) {
    super({ message, httpStatus: conflict });
  }
}

/** Fields that break the rules of the garment form; the message names the field and the rule. */
export class InvalidGarmentEdit extends Schema.TaggedError<InvalidGarmentEdit>()(
  'InvalidGarmentEdit',
  { message: Schema.String, httpStatus: Schema.Literal(badRequest) },
) {
  constructor(reason: string) {
    super({ message: `Invalid garment: ${reason}`, httpStatus: badRequest });
  }
}
