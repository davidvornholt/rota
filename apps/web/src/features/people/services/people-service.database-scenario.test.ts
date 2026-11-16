import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createPool } from '@rota/db/connections';
import { migrateDatabase } from '@rota/db/migrate';
import { env } from 'bun';
import { Effect } from 'effect';

const setupTimeoutMs = 60_000;

// The spawner in people-service.database.test.ts runs this file alone, because
// the modules read their environment once and other tests load them first. In
// an ordinary run the file does nothing, so it never changes the shared
// environment.
const scenario = env.PEOPLE_DATABASE_SCENARIO === 'true';
const adminUrl = env.DATABASE_URL?.trim() ?? '';
const databaseName = `rota_people_${crypto.randomUUID().replaceAll('-', '_')}`;
const databaseUrl = (() => {
  if (!scenario || adminUrl === '') {
    return '';
  }
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
})();

// Everything but the database is invented: the modules under test validate
// the whole server environment when they load, and none of it is used.
if (scenario) {
  // The names are the server's environment variables, so they are written as
  // pairs and not as object keys that the naming rule would reject.
  const synthetic: ReadonlyArray<readonly [string, string]> = [
    ['DATABASE_URL', databaseUrl],
    ['BETTER_AUTH_SECRET', 'synthetic-people-secret-0000000000000'],
    ['BETTER_AUTH_URL', 'http://localhost:9999'],
    ['GITHUB_CLIENT_ID', 'synthetic'],
    ['GITHUB_CLIENT_SECRET', 'synthetic'],
    ['GITHUB_ALLOWED_ACCOUNT_ID', '1'],
    ['ANTHROPIC_API_KEY', 'synthetic-unused'],
    ['FOUNDRY_OPENAI_ENDPOINT', 'https://example.invalid'],
    ['FOUNDRY_OPENAI_API_KEY', 'synthetic-unused'],
    ['FOUNDRY_IMAGE_DEPLOYMENT', 'synthetic'],
    ['FOUNDRY_COLLAGE_DEPLOYMENT', 'synthetic'],
    ['MEDIA_STORE', 'local'],
    ['MEDIA_LOCAL_DIR', '/tmp/rota-people-unused'],
  ];
  Object.assign(env, Object.fromEntries(synthetic));
}

describe.skipIf(!scenario)('inviting a person with a real database', () => {
  let adminPool: ReturnType<typeof createPool> | undefined;
  const admin = () => {
    adminPool ??= createPool(adminUrl);
    return adminPool;
  };

  beforeAll(async () => {
    await admin().query(`CREATE DATABASE "${databaseName}"`);
    const setup = createPool(databaseUrl);
    try {
      await Effect.runPromise(migrateDatabase(setup));
    } finally {
      await setup.end();
    }
  }, setupTimeoutMs);

  afterAll(async () => {
    try {
      const database = await import('#/shared/db/database.ts');
      await database.closeDatabase();
    } finally {
      try {
        await admin().query(
          `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
      } finally {
        await admin().end();
      }
    }
  }, setupTimeoutMs);

  const load = async () => {
    const { issueCode } = await import('./people-service.ts');
    const { pool } = await import('#/shared/db/database.ts');
    const members = async (name: string) =>
      (
        await pool.query<{ n: number }>(
          'select count(*)::int as n from member where name = $1',
          [name],
        )
      ).rows[0]?.n;
    return { issueCode, pool, members };
  };

  it('control: one invitation stores one member', async () => {
    const { issueCode, members } = await load();
    await issueCode({
      name: 'Control Synthetic',
      submissionId: crypto.randomUUID(),
    });
    expect(await members('Control Synthetic')).toBe(1);
  });

  it('answers the same form fill sent again with the same member and a code that works', async () => {
    const { issueCode, pool, members } = await load();
    const { codeDigest } = await import('#/shared/auth/access-codes.ts');
    const submissionId = crypto.randomUUID();
    const first = await issueCode({ name: 'Anna Synthetic', submissionId });
    const again = await issueCode({ name: 'Anna Synthetic', submissionId });

    expect(again.memberId).toBe(first.memberId);
    expect(await members('Anna Synthetic')).toBe(1);
    const users = await pool.query<{ n: number }>(
      `select count(*)::int as n from "user" where name = 'Anna Synthetic'`,
    );
    expect(users.rows[0]?.n).toBe(1);
    // Only the digest of a code is stored, so the repeat replaced the first
    // code with the one it returns.
    const codes = await pool.query<{ digest: string; kind: string }>(
      'select digest, kind from access_code where member_id = $1',
      [first.memberId],
    );
    expect(codes.rows).toEqual([
      { digest: await codeDigest(again.code), kind: 'invitation' },
    ]);
  });

  it('stores one member when the twin requests run at the same time', async () => {
    const { issueCode, members } = await load();
    const submissionId = crypto.randomUUID();
    const [first, second] = await Promise.all([
      issueCode({ name: 'Berta Synthetic', submissionId }),
      issueCode({ name: 'Berta Synthetic', submissionId }),
    ]);
    expect(second.memberId).toBe(first.memberId);
    expect(await members('Berta Synthetic')).toBe(1);
  });

  it('creates a new member for a new form fill with the same name', async () => {
    const { issueCode, members } = await load();
    await issueCode({
      name: 'Cora Synthetic',
      submissionId: crypto.randomUUID(),
    });
    await issueCode({
      name: 'Cora Synthetic',
      submissionId: crypto.randomUUID(),
    });
    expect(await members('Cora Synthetic')).toBe(2);
  });

  it('still creates a member for an invitation sent without an ID, as a page loaded before the deploy does', async () => {
    const { issueCode, members } = await load();
    await issueCode({ name: 'Dora Synthetic' });
    await issueCode({ name: 'Dora Synthetic' });
    expect(await members('Dora Synthetic')).toBe(2);
  });

  it('gives no code for a repeated invitation once the member is suspended', async () => {
    const { issueCode, pool, members } = await load();
    const submissionId = crypto.randomUUID();
    const first = await issueCode({ name: 'Emma Synthetic', submissionId });
    await pool.query('update member set enabled = false where id = $1', [
      first.memberId,
    ]);
    await expect(
      issueCode({ name: 'Emma Synthetic', submissionId }),
    ).rejects.toThrow();
    expect(await members('Emma Synthetic')).toBe(1);
  });
});
