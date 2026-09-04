import { Data } from 'effect';

/** An upload the app refuses before storing anything; the status tells the browser how to say so. */
export class UploadError extends Data.TaggedError('UploadError')<{
  readonly message: string;
  readonly httpStatus: 400 | 413;
}> {}
