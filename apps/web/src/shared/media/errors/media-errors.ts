import { Data } from 'effect';

export class MediaStoreError extends Data.TaggedError('MediaStoreError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}
