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

/** A retire, restore, or delete the garment's state doesn't allow; the message says what to do instead. */
export class GarmentLifecycleError extends Schema.TaggedError<GarmentLifecycleError>()(
  'GarmentLifecycleError',
  { message: Schema.String, httpStatus: Schema.Literal(conflict) },
) {
  constructor(message: string) {
    super({ message, httpStatus: conflict });
  }
}
