import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import { whenWaiting } from './when-waiting.ts';

const readFor = (status: Garment['status']) => {
  const read: Array<string> = [];
  const garments = {
    byId: (id: string) => Effect.succeed({ id, status } as Garment),
  };
  return Effect.runPromise(
    whenWaiting(garments, 'garment-1', (garment) =>
      Effect.sync(() => read.push(garment.id)),
    ),
  ).then(() => read);
};

describe('whenWaiting', () => {
  it('reads a garment that still waits', async () => {
    expect(await readFor('processing')).toEqual(['garment-1']);
  });

  it('leaves a garment that was read and moved on alone', async () => {
    // The retry stored its photo while the first reading finished and the
    // owner accepted the garment.
    const answers = await Promise.all(
      (['review', 'active', 'retired'] as const).map(readFor),
    );
    expect(answers).toEqual([[], [], []]);
  });
});
