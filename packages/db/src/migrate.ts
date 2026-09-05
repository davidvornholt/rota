import { readMigrationFiles } from 'drizzle-orm/migrator';
import { NodePgSession } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Data, Effect } from 'effect';
import type { Pool } from 'pg';
import { withGarmentScaleBackfill } from './garment-scale-migration.ts';

export class DatabaseMigrationError extends Data.TaggedError(
  'DatabaseMigrationError',
)<{ readonly message: string; readonly cause: unknown }> {}

export const migrationFolder = decodeURIComponent(
  new URL('../drizzle', import.meta.url).pathname,
);

/** Applies every generated Drizzle migration that the database has not seen. */
export const migrateDatabase = (pool: Pool) =>
  Effect.tryPromise({
    try: () => {
      const config = { migrationsFolder: migrationFolder };
      const migrations = withGarmentScaleBackfill(readMigrationFiles(config));
      const dialect = new PgDialect();
      return dialect.migrate(
        migrations,
        new NodePgSession(pool, dialect, undefined),
        config,
      );
    },
    catch: (cause) =>
      new DatabaseMigrationError({
        message: 'The generated Drizzle migrations failed.',
        cause,
      }),
  });
