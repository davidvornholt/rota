import { account, session, user, verification } from '@rota/db/auth-schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

import { pool } from '#/shared/db/pool.ts';
import { env } from '#/shared/env.ts';
import { createAuthOptions } from './auth-options.ts';

const schema = { account, session, user, verification };
const db = drizzle(pool, { schema });

export const auth = betterAuth({
  ...createAuthOptions({
    allowedGitHubAccountId: env.GITHUB_ALLOWED_ACCOUNT_ID,
    baseURL: env.BETTER_AUTH_URL,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    secret: env.BETTER_AUTH_SECRET,
  }),
  database: drizzleAdapter(db, { provider: 'pg' }),
});
