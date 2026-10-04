import { Schema } from 'effect';

export class MediaStoreError extends Schema.TaggedError<MediaStoreError>()(
  'MediaStoreError',
  { message: Schema.String, cause: Schema.Defect() },
) {}
