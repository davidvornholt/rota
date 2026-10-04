import { Schema } from 'effect';

/** A query that could not be run or a row that could not be decoded. */
export class DataReadError extends Schema.TaggedError<DataReadError>()(
  'DataReadError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

export class DataWriteError extends Schema.TaggedError<DataWriteError>()(
  'DataWriteError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

const notFoundStatus = 404;

/** Named so the browser can hear it: the row the request named does not exist. */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  'NotFoundError',
  { message: Schema.String, httpStatus: Schema.Literal(notFoundStatus) },
) {}

export const notFound = (what: string): NotFoundError =>
  new NotFoundError({
    message: `${what} was not found.`,
    httpStatus: notFoundStatus,
  });

export const readError = (what: string) => (cause: unknown) =>
  new DataReadError({ message: `${what} could not be read.`, cause });

export const writeError = (what: string) => (cause: unknown) =>
  new DataWriteError({ message: `${what} could not be saved.`, cause });
