/**
 * The Effect SQL client.
 *
 * Effect 4's `@effect/sql-pg` speaks the Postgres wire protocol itself and no
 * longer wraps a `pg` pool, so this client keeps a small pool of its own next
 * to the `pg` pool that better-auth's Drizzle adapter uses. Both read the same
 * connection string, so the settings are still written down once.
 *
 * The layer owns its connections: they open lazily, idle ones close again, and
 * closing the layer's scope closes the pool. Build it once per process and
 * share the result, because every build opens another pool.
 */

import { PgClient } from '@effect/sql-pg';
import { type Layer, Redacted } from 'effect';
import type { SqlClient } from 'effect/sql/SqlClient';
import type { SqlError } from 'effect/sql/SqlError';

export const pgClientLayer = (
  connectionString: string,
): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layer({ url: Redacted.make(connectionString) });
