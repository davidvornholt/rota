import { Cause, Effect } from 'effect';
import pg from 'pg';

import { preservePostgresDates } from './postgres-date.ts';

/**
 * One process, one pool: every consumer shares the pool the app creates from
 * this factory, which today is better-auth's Drizzle adapter.
 *
 * An idle pooled connection can fail long after the query that opened it
 * returned — the database restarts, or a proxy times the socket out. pg emits
 * that on the pool, and Node treats an unhandled 'error' event as fatal, so
 * this listener is what keeps a dropped idle connection survivable and visible
 * rather than silent.
 */
export const createPool = (connectionString: string): pg.Pool => {
  preservePostgresDates();
  const pool = new pg.Pool({ connectionString });
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
