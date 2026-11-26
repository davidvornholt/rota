import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';

import type { GarmentAttributes } from '#/shared/data/garment-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { ImageChoice } from '#/shared/data/garment-types.ts';

/**
 * Saves the review card's fields and accepts the garment in one transaction,
 * so an accept that is refused, such as one the CLI got to first, leaves the
 * garment as it was instead of keeping half the save.
 */
export const acceptEdited = (
  id: string,
  edit: GarmentAttributes,
  revision: number,
  choice: ImageChoice,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const garments = yield* GarmentRepository;
    yield* sql.withTransaction(
      Effect.andThen(
        garments.update(id, edit, revision),
        // The update advanced the revision by one.
        garments.accept(id, choice, revision + 1),
      ),
    );
  });
