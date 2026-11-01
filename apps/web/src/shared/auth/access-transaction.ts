// biome-ignore lint/correctness/noNodejsModules: Auth transactions run only on the Bun/Node server.
import { AsyncLocalStorage } from 'node:async_hooks';
import { pool } from '#/shared/db/database.ts';
import { commitsResult } from './auth-commit.ts';

const connect = () => pool.connect();
type Client = Awaited<ReturnType<typeof connect>>;
const currentClient = new AsyncLocalStorage<Client>();

/** Better Auth and its hooks must use the same transaction as revocation. */
export const authPool = new Proxy(pool, {
  get(target, property) {
    const connection = currentClient.getStore() ?? target;
    if (property === 'query') {
      return connection.query.bind(connection);
    }
    return Reflect.get(target, property);
  },
});

/**
 * Serialize the small household's access changes across server processes. All
 * reads and writes use this client, so waiting requests cannot exhaust the pool
 * while the lock holder needs another connection. A lost connection also aborts
 * its credential/session writes, rather than merely releasing a separate lock.
 * `commits` decides whether the outermost transaction keeps the work's writes.
 */
export const withAccessTransaction = async <A>(
  work: (client: Client) => Promise<A>,
  commits: (result: A) => boolean | Promise<boolean> = commitsResult,
): Promise<A> => {
  const existing = currentClient.getStore();
  if (existing) {
    return work(existing);
  }
  const client = await connect();
  let reusable = false;
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('rota:access', 0))",
    );
    const result = await currentClient.run(client, () => work(client));
    await client.query((await commits(result)) ? 'commit' : 'rollback');
    reusable = true;
    return result;
  } finally {
    // Destroy failed connections: PostgreSQL rolls back and releases the lock,
    // including when COMMIT/ROLLBACK itself failed or the connection was lost.
    client.release(!reusable);
  }
};
