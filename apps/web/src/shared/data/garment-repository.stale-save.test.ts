import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createPool, pgClientLayer } from '@rota/db/connections';
import { env } from 'bun';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { createDisposableDatabase } from './disposable-database.ts';
import { GarmentRepository } from './garment-repository.ts';

const setupTimeoutMs = 60_000;
const adminDatabaseUrl = env.DATABASE_URL?.trim() ?? '';

/**
 * A disposable database with one owner's garment repository, made before the
 * tests of the calling `describe` and dropped after them.
 */
const garmentDatabase = (prefix: string) => {
  const owner = {
    id: `stale-${crypto.randomUUID()}`,
    userId: 'synthetic-user',
    name: 'Synthetic',
    admin: false,
  };
  let database:
    | Awaited<ReturnType<typeof createDisposableDatabase>>
    | undefined;
  let pool: ReturnType<typeof createPool> | undefined;
  let runtime:
    | ManagedRuntime.ManagedRuntime<GarmentRepository, unknown>
    | undefined;

  beforeAll(async () => {
    database = await createDisposableDatabase(adminDatabaseUrl, prefix);
    pool = createPool(database.url);
    runtime = ManagedRuntime.make(
      GarmentRepository.layer.pipe(
        Layer.provide(
          Layer.merge(
            pgClientLayer(database.url),
            Layer.succeed(WardrobeOwner, owner),
          ),
        ),
      ),
    );
  }, setupTimeoutMs);

  afterAll(async () => {
    await runtime?.dispose();
    await pool?.end();
    await database?.drop();
  }, setupTimeoutMs);

  const run = <A, E>(
    use: (garments: GarmentRepository['Service']) => Effect.Effect<A, E>,
  ) => {
    if (runtime === undefined) {
      throw new Error('The database is not ready.');
    }
    return runtime.runPromise(Effect.flatMap(GarmentRepository, use));
  };
  const insert = async (status: 'active' | 'review' = 'active') => {
    const id = crypto.randomUUID();
    await pool?.query(
      `INSERT INTO garment (id, owner_id, name, category, status, slots, colors, notes)
       VALUES ($1, $2, 'Synthetic shirt', 'shirt', $3, ARRAY['top']::garment_slot[], '[{"hex":"#ffffff"}]'::jsonb, 'Original note')`,
      [id, owner.id, status],
    );
    return id;
  };
  return { run, insert };
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
