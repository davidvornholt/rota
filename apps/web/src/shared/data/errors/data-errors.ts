import { Data } from 'effect';

/** A query that could not be run or a row that could not be decoded. */
export class DataReadError extends Data.TaggedError('DataReadError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class DataWriteError extends Data.TaggedError('DataWriteError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/** Named so the browser can hear it: the row the request named does not exist. */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string;
  readonly httpStatus: 404;
}> {}

export const notFound = (what: string): NotFoundError =>
  new NotFoundError({ message: `${what} was not found.`, httpStatus: 404 });

export const readError = (what: string) => (cause: unknown) =>
  new DataReadError({ message: `${what} could not be read.`, cause });

export const writeError = (what: string) => (cause: unknown) =>
  new DataWriteError({ message: `${what} could not be saved.`, cause });
