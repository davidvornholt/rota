import { migrateDatabase } from '@rota/db/migrate';
import { createPool } from '@rota/db/pool';
import { Effect } from 'effect';

const databaseUrl = Bun.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set.');
}

const migrationPool = createPool(databaseUrl);

await Effect.runPromise(
  migrateDatabase(migrationPool).pipe(
    Effect.ensuring(Effect.promise(() => migrationPool.end())),
  ),
);
