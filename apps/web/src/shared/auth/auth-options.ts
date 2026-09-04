import type { BetterAuthOptions } from 'better-auth';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { createGitHubAccountGate } from './authorization.ts';

type AuthOptionsInput = {
  readonly allowedGitHubAccountId: string;
  readonly baseURL: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
  readonly secret: string;
};

/**
 * Every better-auth option except the database adapter. Kept apart from
 * `auth.ts` so tests can read the real option shape — the shape that decides
 * which table columns better-auth requires — without booting the app against
 * real configuration or a database.
 */
export const createAuthOptions = ({
  allowedGitHubAccountId,
  baseURL,
  githubClientId,
  githubClientSecret,
  secret,
}: AuthOptionsInput) =>
  ({
    secret,
    baseURL,
    socialProviders: {
      github: { clientId: githubClientId, clientSecret: githubClientSecret },
    },
    user: { validateUserInfo: createGitHubAccountGate(allowedGitHubAccountId) },
    /** Provider access tokens are encrypted with `secret` before they are stored. */
    account: { encryptOAuthTokens: true },
    plugins: [tanstackStartCookies()],
  }) satisfies BetterAuthOptions;
