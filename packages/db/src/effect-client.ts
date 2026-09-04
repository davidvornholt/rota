/**
 * The Effect SQL client, built on the pool this package already hands out.
 *
 * `PgClient.layer` would open a pool of its own from a connection string, which
 * would mean two pools against one database and the connection settings written
 * down twice — once here and once wherever better-auth's adapter is wired. The
 * pool stays the app's, created once by `createPool`, and this wraps it.
 *
 * `acquire` therefore only hands the pool over: it does not open one and it must
 * not close one. The pool outlives every Effect scope in the process, because
 * better-auth holds the same object and knows nothing about Effect's scopes.
 */

import type { SqlClient } from '@effect/sql/SqlClient';
import type { SqlError } from '@effect/sql/SqlError';
import { PgClient } from '@effect/sql-pg';
import { Effect, type Layer } from 'effect';
import type pg from 'pg';

export const pgClientLayer = (
  pool: pg.Pool,
): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layerFromPool({ acquire: Effect.succeed(pool) });
