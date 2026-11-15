import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';

/**
 * Runs `work` on the garment only while it still waits for its reading. A
 * photo sent again after a lost answer can start a second reading once the
 * first one has finished; by then the garment has moved on, and reading it
 * again would pay for the model twice and undo what the owner did since.
 */
export const whenWaiting = <A, E, R>(
  garments: {
    readonly byId: (id: string) => Effect.Effect<Garment, E>;
  },
  id: string,
  work: (garment: Garment) => Effect.Effect<A, E, R>,
) =>
  garments
    .byId(id)
    .pipe(
      Effect.flatMap((garment) =>
        garment.status === 'processing' ? work(garment) : Effect.void,
      ),
    );
