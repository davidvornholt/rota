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
import { env } from '#/shared/env.ts';
import { authPool, withAccessTransaction } from './access-transaction.ts';
import { createAuthOptions } from './auth-options.ts';
import { familyPasskeys } from './passkeys.ts';

const schema = { account, passkey, session, user, verification };
const db = drizzle(authPool, { schema });

const options = createAuthOptions({
  allowedGitHubAccountId: env.GITHUB_ALLOWED_ACCOUNT_ID,
  baseURL: env.BETTER_AUTH_URL,
  githubClientId: env.GITHUB_CLIENT_ID,
  githubClientSecret: env.GITHUB_CLIENT_SECRET,
  secret: env.BETTER_AUTH_SECRET,
});

export const auth = betterAuth({
  ...options,
  plugins: [familyPasskeys(env.BETTER_AUTH_URL), ...options.plugins],
  database: drizzleAdapter(db, { provider: 'pg', transaction: false }),
});

export const handleAuth = (request: Request) =>
  withAccessTransaction(() => auth.handler(request));
