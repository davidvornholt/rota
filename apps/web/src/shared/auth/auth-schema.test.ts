import { expect, it } from 'bun:test';
import {
  account,
  passkey,
  session,
  user,
  verification,
} from '@rota/db/auth-schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createAuthOptions } from './auth-options.ts';

const ok = 200;

it('the real auth adapter accepts the production account schema before serving requests', async () => {
  const auth = betterAuth({
    ...createAuthOptions({
      allowedGitHubAccountId: '123',
      baseURL: 'http://localhost:3100',
      githubClientId: 'fixture-client',
      githubClientSecret: 'fixture-secret',
      secret: 'auth-schema-public-fixture-secret-123456',
    }),
    database: drizzleAdapter(
      drizzle.mock({
        schema: { account, passkey, session, user, verification },
      }),
      { provider: 'pg' },
    ),
  });
  // Schema validation runs during initialization without querying a database.
  const response = await auth.handler(
    new Request('http://localhost:3100/api/auth/get-session'),
  );
  expect(response.status).toBe(ok);
  expect(await response.json()).toBeNull();
});
