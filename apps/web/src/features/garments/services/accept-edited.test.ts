import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { env } from 'bun';
import { Effect } from 'effect';
import {
  garmentTestDatabase,
  garmentTestSetupMs,
} from '#/shared/data/garment-test-database.ts';
import { acceptEdited } from './accept-edited.ts';

const adminDatabaseUrl = env.DATABASE_URL?.trim() ?? '';

// The review card saves its fields and accepts in one go. When the accept is
// refused, such as because the CLI accepted the garment first, the card's
// save must not stay behind on its own.
describe.skipIf(adminDatabaseUrl === '')(
  'accepting a garment from its review card',
  () => {
    const database = garmentTestDatabase(
      adminDatabaseUrl,
      'rota_accept_edited',
    );
    beforeAll(database.start, garmentTestSetupMs);
    afterAll(database.stop, garmentTestSetupMs);

    it('saves the fields and accepts the garment together', async () => {
      const id = await database.insert('review');
      const loaded = await database.run((garments) => garments.byId(id));

      await database.runEffect(
        acceptEdited(
          id,
          { ...loaded, name: 'Renamed' },
          loaded.revision,
          'original',
        ),
      );

      expect(await database.run((garments) => garments.byId(id))).toMatchObject(
        {
          name: 'Renamed',
          status: 'active',
          imageChoice: 'original',
          revision: loaded.revision + 2,
        },
      );
    });

    it('keeps none of the fields when the accept is refused', async () => {
      const id = await database.insert('active');
      const loaded = await database.run((garments) => garments.byId(id));

      const refused = await database.runEffect(
        Effect.flip(
          acceptEdited(
            id,
            { ...loaded, name: 'Renamed' },
            loaded.revision,
            'studio',
          ),
        ),
      );

      expect(refused._tag).toBe('StaleEditError');
      expect(await database.run((garments) => garments.byId(id))).toMatchObject(
        {
          name: 'Synthetic shirt',
          revision: loaded.revision,
        },
      );
    });
  },
);
