/**
 * The database connections a process opens, configured in one place.
 *
 * A server process holds two pools against the same database. better-auth's
 * Drizzle adapter, the access transaction, and the raw queries use a `pg` pool.
 * The Effect SQL client cannot share it: Effect 4's `@effect/sql-pg` speaks the
 * Postgres wire protocol itself and has no way to adopt a `pg` pool, and
 * better-auth has no Effect adapter. So the client opens a pool of its own.
 *
 * Their sizes split the ten connections the single `pg` pool was allowed
 * before (pg's default), so a process still never holds more than ten against
 * a production Postgres whose 100 connections every app on the host shares.
 * Both pools open connections on demand and close idle ones after ten seconds.
 *
 * Whoever creates a pool closes it: `pool.end()` for the `pg` pool, and the
 * scope the layer was built in for the Effect client.
 */

import { PgClient } from '@effect/sql-pg';
import { Cause, Effect, type Layer, Redacted } from 'effect';
import type { SqlClient } from 'effect/sql/SqlClient';
import type { SqlError } from 'effect/sql/SqlError';
import pg from 'pg';

import { preservePostgresDates } from './postgres-date.ts';

const pgPoolSize = 4;
const sqlClientPoolSize = 6;

/**
 * The `pg` pool.
 *
 * An idle pooled connection can fail long after the query that opened it
 * returned — the database restarts, or a proxy times the socket out. pg emits
 * that on the pool, and Node treats an unhandled 'error' event as fatal, so
 * this listener is what keeps a dropped idle connection survivable and visible
 * rather than silent.
 */
export const createPool = (connectionString: string): pg.Pool => {
  preservePostgresDates();
  const pool = new pg.Pool({ connectionString, max: pgPoolSize });
  pool.on('error', (error) => {
    Effect.runSync(
      Effect.logError(
        'Postgres pool error on an idle client.',
        Cause.die(error),
      ),
    );
  });
  return pool;
};

/**
 * The Effect SQL client and its pool. Building the layer opens no connection,
 * and closing the scope it was built in closes the pool, so build it once per
 * process and share the result: every build opens another pool.
 */
export const pgClientLayer = (
  connectionString: string,
): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layer({
    url: Redacted.make(connectionString),
    maxConnections: sqlClientPoolSize,
  });
