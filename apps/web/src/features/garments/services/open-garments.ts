import { Effect } from 'effect';
import type { CreatedGarment } from '#/shared/data/garment-repository.ts';
import type { Upload } from './photo-upload.ts';

/** The two steps of the ingest service that opening garments needs. */
type Opener<E> = {
  readonly start: (
    upload: Upload,
    uploadId: string,
  ) => Effect.Effect<CreatedGarment, E>;
  readonly process: (id: string) => Effect.Effect<void>;
};

/**
 * Opens a garment for each photo and starts reading the ones that wait for it.
 * A photo whose upload id opened a garment before, because the answer to the
 * first try was lost, answers with that garment. One already read, or being
 * read, is left alone, so a retry never pays for a second reading.
 */
export const openGarments = <E>(
  ingest: Opener<E>,
  uploads: ReadonlyArray<{
    readonly upload: Upload;
    readonly uploadId: string;
  }>,
) =>
  Effect.gen(function* () {
    const opened: Array<CreatedGarment> = [];
    for (const { upload, uploadId } of uploads) {
      opened.push(yield* ingest.start(upload, uploadId));
    }
    for (const { id, status } of opened) {
      if (status === 'processing') {
        yield* ingest.process(id);
      }
    }
    return opened.map(({ id }) => id);
  });
