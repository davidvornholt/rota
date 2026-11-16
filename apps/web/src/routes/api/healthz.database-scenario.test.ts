import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createPool } from '@rota/db/connections';
import { migrateDatabase } from '@rota/db/migrate';
import { env } from 'bun';
import { Effect, Layer, ManagedRuntime } from 'effect';

const okStatus = 200;
const unavailableStatus = 503;
const setupTimeoutMs = 60_000;
const deadlineMs = 1500;

// The spawner in healthz.database.test.ts runs this file alone, because the
// modules read their environment once and other tests load them first. In an
// ordinary run the file does nothing, so it never changes the shared environment.
const scenario = env.HEALTHZ_DATABASE_SCENARIO === 'true';
const adminUrl = env.DATABASE_URL?.trim() ?? '';
const databaseName = `rota_health_${crypto.randomUUID().replaceAll('-', '_')}`;
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
  Object.assign(env, {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'synthetic-health-secret-00000000000000',
    BETTER_AUTH_URL: 'http://localhost:9999',
    GITHUB_CLIENT_ID: 'synthetic',
    GITHUB_CLIENT_SECRET: 'synthetic',
    GITHUB_ALLOWED_ACCOUNT_ID: '1',
    ANTHROPIC_API_KEY: 'synthetic-unused',
    FOUNDRY_OPENAI_ENDPOINT: 'https://example.invalid',
    FOUNDRY_OPENAI_API_KEY: 'synthetic-unused',
    FOUNDRY_IMAGE_DEPLOYMENT: 'synthetic',
    FOUNDRY_COLLAGE_DEPLOYMENT: 'synthetic',
    MEDIA_STORE: 'local',
    MEDIA_LOCAL_DIR: '/tmp/rota-health-unused',
  });
}

describe.skipIf(!scenario)('GET /api/healthz with a real database', () => {
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
      await admin().query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
    } finally {
      await admin().end();
    }
  }, setupTimeoutMs);

  it(
    'reports unavailable while the wardrobe cannot be read and recovers without a restart',
    async () => {
      const { getHealth: health } = await import('./healthz.ts');
      const { WardrobeOwner } = await import('#/shared/auth/identity.ts');
      const { GarmentRepository } = await import(
        '#/shared/data/garment-repository.ts'
      );
      const database = await import('#/shared/db/database.ts');
      // The production database layer and the real repository.
      const runtime = ManagedRuntime.make(
        GarmentRepository.layer.pipe(
          Layer.provide(database.sqlClientLayer),
          Layer.provide(
            Layer.succeed(WardrobeOwner, {
              id: 'health-owner',
              userId: 'health-user',
              name: 'Synthetic owner',
              admin: false,
            }),
          ),
        ),
      );
      const list = Effect.flatMap(GarmentRepository, (garments) =>
        garments.list(),
      );
      try {
        const healthyResponse = await health();
        expect(healthyResponse.status).toBe(okStatus);
        expect(await healthyResponse.json()).toEqual({ status: 'ok' });

        await admin().query(
          `ALTER DATABASE "${databaseName}" ALLOW_CONNECTIONS false`,
        );
        const startedAt = performance.now();
        const failed = await runtime.runPromise(Effect.exit(list));
        const unavailable = await health();
        const elapsed = performance.now() - startedAt;

        expect(failed._tag).toBe('Failure');
        expect(unavailable.status).toBe(unavailableStatus);
        expect(unavailable.headers.get('cache-control')).toBe('no-store');
        expect(await unavailable.text()).toBe('');
        expect(elapsed).toBeLessThan(deadlineMs * 2);

        await admin().query(
          `ALTER DATABASE "${databaseName}" ALLOW_CONNECTIONS true`,
        );
        const recovered = await runtime.runPromise(list);
        const recoveredResponse = await health();

        expect(recovered).toEqual([]);
        expect(recoveredResponse.status).toBe(okStatus);
      } finally {
        await admin().query(
          `ALTER DATABASE "${databaseName}" ALLOW_CONNECTIONS true`,
        );
        await runtime.dispose();
        await database.closeDatabase();
      }
    },
    setupTimeoutMs,
  );
});
