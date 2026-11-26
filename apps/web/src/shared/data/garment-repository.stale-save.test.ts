import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { env } from 'bun';
import { Effect } from 'effect';
import {
  garmentTestDatabase,
  garmentTestSetupMs,
} from './garment-test-database.ts';

const adminDatabaseUrl = env.DATABASE_URL?.trim() ?? '';

/** A disposable database for the tests of the calling `describe`. */
const garmentDatabase = (prefix: string) => {
  const database = garmentTestDatabase(adminDatabaseUrl, prefix);
  beforeAll(database.start, garmentTestSetupMs);
  afterAll(database.stop, garmentTestSetupMs);
  return database;
};

// Two tabs open the same garment and each form sends every editable
// attribute, so the form that was loaded first must not undo what the
// other tab saved.
describe.skipIf(adminDatabaseUrl === '')(
  'saving a garment from a form that may be out of date',
  () => {
    const { run, insert } = garmentDatabase('rota_stale_garment');

    it('keeps the care note another tab saved by refusing the older form', async () => {
      const id = await insert();
      const loaded = await run((garments) => garments.byId(id));
      await run((garments) =>
        garments.update(
          id,
          { ...loaded, notes: 'Hand wash only' },
          loaded.revision,
        ),
      );

      const refused = await run((garments) =>
        Effect.flip(
          garments.update(
            id,
            { ...loaded, name: 'Renamed shirt' },
            loaded.revision,
          ),
        ),
      );

      expect(refused._tag).toBe('StaleEditError');
      const stored = await run((garments) => garments.byId(id));
      expect(stored).toMatchObject({
        name: 'Synthetic shirt',
        notes: 'Hand wash only',
      });
    });

    it('saves a form that was reloaded after the other tab saved', async () => {
      const id = await insert();
      const loaded = await run((garments) => garments.byId(id));
      await run((garments) =>
        garments.update(
          id,
          { ...loaded, notes: 'Hand wash only' },
          loaded.revision,
        ),
      );
      const reloaded = await run((garments) => garments.byId(id));

      await run((garments) =>
        garments.update(
          id,
          { ...reloaded, name: 'Renamed shirt' },
          reloaded.revision,
        ),
      );

      const stored = await run((garments) => garments.byId(id));
      expect(stored).toMatchObject({
        name: 'Renamed shirt',
        notes: 'Hand wash only',
        revision: reloaded.revision + 1,
      });
    });
  },
);

// A review card and the CLI can both accept a garment, so the first accept
// must make the other, and every form opened before it, stale.
describe.skipIf(adminDatabaseUrl === '')(
  'accepting a garment that waits for review',
  () => {
    const { run, insert } = garmentDatabase('rota_accept_garment');

    it('accepts a garment once, so a second accept or an older form is refused', async () => {
      const id = await insert('review');
      const loaded = await run((garments) => garments.byId(id));
      await run((garments) => garments.accept(id, 'original', loaded.revision));

      const again = await run((garments) =>
        Effect.flip(garments.accept(id, 'studio', loaded.revision)),
      );
      const olderForm = await run((garments) =>
        Effect.flip(
          garments.update(id, { ...loaded, name: 'Renamed' }, loaded.revision),
        ),
      );

      expect(again._tag).toBe('StaleEditError');
      expect(olderForm._tag).toBe('StaleEditError');
      const stored = await run((garments) => garments.byId(id));
      expect(stored).toMatchObject({
        status: 'active',
        imageChoice: 'original',
        name: 'Synthetic shirt',
        revision: loaded.revision + 1,
      });
    });

    it('refuses an accept based on the garment before an edit', async () => {
      const id = await insert('review');
      const loaded = await run((garments) => garments.byId(id));
      await run((garments) =>
        garments.update(id, { ...loaded, notes: 'Dry flat' }, loaded.revision),
      );

      const refused = await run((garments) =>
        Effect.flip(garments.accept(id, 'studio', loaded.revision)),
      );

      expect(refused._tag).toBe('StaleEditError');
      expect(await run((garments) => garments.byId(id))).toMatchObject({
        status: 'review',
        notes: 'Dry flat',
      });
    });

    it('refuses to accept a garment that is not waiting for review', async () => {
      const id = await insert('active');
      const loaded = await run((garments) => garments.byId(id));

      const refused = await run((garments) =>
        Effect.flip(garments.accept(id, 'studio', loaded.revision)),
      );

      expect(refused._tag).toBe('StaleEditError');
      expect(await run((garments) => garments.byId(id))).toMatchObject({
        status: 'active',
        revision: loaded.revision,
      });
    });
  },
);
