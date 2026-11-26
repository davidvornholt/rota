import { createPool, pgClientLayer } from '@rota/db/connections';
import { Effect, Layer, ManagedRuntime } from 'effect';
import type { SqlClient } from 'effect/sql';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { createDisposableDatabase } from './disposable-database.ts';
import { GarmentRepository } from './garment-repository.ts';

/** Creating and dropping a database can take a while on a cold CI runner. */
export const garmentTestSetupMs = 60_000;

/**
 * A disposable database with one owner's garment repository, for tests that
 * need real Postgres. Call `start` before the tests and `stop` after them.
 */
export const garmentTestDatabase = (adminUrl: string, prefix: string) => {
  const owner = {
    id: `test-${crypto.randomUUID()}`,
    userId: 'synthetic-user',
    name: 'Synthetic',
    admin: false,
  };
  let database:
    | Awaited<ReturnType<typeof createDisposableDatabase>>
    | undefined;
  let pool: ReturnType<typeof createPool> | undefined;
  let runtime:
    | ManagedRuntime.ManagedRuntime<
        GarmentRepository | SqlClient.SqlClient,
        unknown
      >
    | undefined;

  const start = async () => {
    database = await createDisposableDatabase(adminUrl, prefix);
    pool = createPool(database.url);
    runtime = ManagedRuntime.make(
      GarmentRepository.layer.pipe(
        Layer.provideMerge(
          Layer.merge(
            pgClientLayer(database.url),
            Layer.succeed(WardrobeOwner, owner),
          ),
        ),
      ),
    );
  };

  const stop = async () => {
    await runtime?.dispose();
    await pool?.end();
    await database?.drop();
  };

  /** Runs work that needs the repository or the SQL client. */
  const runEffect = <A, E>(
    work: Effect.Effect<A, E, GarmentRepository | SqlClient.SqlClient>,
  ) => {
    if (runtime === undefined) {
      throw new Error('The database is not ready.');
    }
    return runtime.runPromise(work);
  };

  const run = <A, E>(
    use: (garments: GarmentRepository['Service']) => Effect.Effect<A, E>,
  ) => runEffect(Effect.flatMap(GarmentRepository, use));

  const insert = async (status: 'active' | 'review' = 'active') => {
    const id = crypto.randomUUID();
    await pool?.query(
      `INSERT INTO garment (id, owner_id, name, category, status, slots, colors, notes)
       VALUES ($1, $2, 'Synthetic shirt', 'shirt', $3, ARRAY['top']::garment_slot[], '[{"hex":"#ffffff"}]'::jsonb, 'Original note')`,
      [id, owner.id, status],
    );
    return id;
  };

  return { start, stop, run, runEffect, insert };
};
