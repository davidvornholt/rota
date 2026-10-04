import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Effect, Schema } from 'effect';
import type { Pool } from 'pg';

export class DatabaseMigrationError extends Schema.TaggedError<DatabaseMigrationError>()(
  'DatabaseMigrationError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

export const migrationFolder = decodeURIComponent(
  new URL('../drizzle', import.meta.url).pathname,
);

/** Applies every generated Drizzle migration that the database has not seen. */
export const migrateDatabase = (pool: Pool) =>
  Effect.tryPromise({
    try: () => migrate(drizzle(pool), { migrationsFolder: migrationFolder }),
    catch: (cause) =>
      new DatabaseMigrationError({
        message: 'The generated Drizzle migrations failed.',
        cause,
      }),
  });
