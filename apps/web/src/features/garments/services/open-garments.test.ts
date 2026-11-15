import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { CreatedGarment } from '#/shared/data/garment-repository.ts';
import { openGarments } from './open-garments.ts';

const photo = { bytes: new Uint8Array([1]), mime: 'image/png' };
const upload = (uploadId: string) => ({ upload: photo, uploadId });

/** Stands in for the ingest service: the first sight of an upload id opens a garment, later sights find it. */
const makeIngest = () => {
  const opened = new Map<string, CreatedGarment>();
  const processed: Array<string> = [];
  return {
    opened,
    processed,
    start: (_upload: unknown, uploadId: string) =>
      Effect.sync(() => {
        const known = opened.get(uploadId);
        if (known !== undefined) {
          return known;
        }
        const created: CreatedGarment = {
          id: `garment-${opened.size + 1}`,
          status: 'processing',
        };
        opened.set(uploadId, created);
        return created;
      }),
    process: (id: string) =>
      Effect.sync(() => {
        processed.push(id);
        for (const [uploadId, garment] of opened) {
          if (garment.id === id) {
            opened.set(uploadId, { id, status: 'review' });
          }
        }
      }),
  };
};

describe('openGarments', () => {
  it('opens one garment for a photo sent again after its answer was lost', async () => {
    const ingest = makeIngest();
    const first = await Effect.runPromise(openGarments(ingest, [upload('a')]));
    const retry = await Effect.runPromise(openGarments(ingest, [upload('a')]));
    expect(retry).toEqual(first);
    expect(ingest.opened.size).toBe(1);
  });

  it('reads the garment once, not again for the retry', async () => {
    const ingest = makeIngest();
    await Effect.runPromise(openGarments(ingest, [upload('a')]));
    await Effect.runPromise(openGarments(ingest, [upload('a')]));
    expect(ingest.processed).toEqual(['garment-1']);
  });

  it('reads a garment that still waits, such as one whose reading never began', async () => {
    const ingest = makeIngest();
    await Effect.runPromise(ingest.start(photo, 'a'));
    await Effect.runPromise(openGarments(ingest, [upload('a')]));
    expect(ingest.processed).toEqual(['garment-1']);
  });

  it('keeps two identical photos with different upload ids apart', async () => {
    const ingest = makeIngest();
    const ids = await Effect.runPromise(
      openGarments(ingest, [upload('a'), upload('b')]),
    );
    expect(ids).toEqual(['garment-1', 'garment-2']);
    expect(ingest.processed).toEqual(['garment-1', 'garment-2']);
  });
});
