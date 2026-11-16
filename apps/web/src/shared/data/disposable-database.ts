import { createPool } from '@rota/db/connections';
import { migrateDatabase } from '@rota/db/migrate';
import { Effect } from 'effect';

/**
 * Makes a migrated database that only one test file uses, next to the one
 * `adminDatabaseUrl` names, and returns its connection string and a function
 * that drops it again. The administrative database is never written to.
 */
export const createDisposableDatabase = async (
  adminDatabaseUrl: string,
  prefix: string,
) => {
  const name = `${prefix}_${crypto.randomUUID().replaceAll('-', '_')}`;
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${name}`;
  const admin = createPool(adminDatabaseUrl);
  await admin.query(`CREATE DATABASE "${name}"`);
  const setup = createPool(url.toString());
  try {
    await Effect.runPromise(migrateDatabase(setup));
  } finally {
    await setup.end();
  }
  return {
    url: url.toString(),
    drop: async () => {
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    },
  };
};
