import { deviceClientId } from '@rota/api/device-login';
import type { BetterAuthOptions } from 'better-auth';
import { bearer, deviceAuthorization } from 'better-auth/plugins';
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
    account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
    plugins: [
      // `rota login` asks for a device code, the member approves it at
      // /device, and the CLI then sends the session token as a bearer token.
      deviceAuthorization({
        expiresIn: '15m',
        validateClient: (clientId) => clientId === deviceClientId,
        verificationUri: '/device',
      }),
      bearer(),
      // Better Auth requires this one to come last.
      tanstackStartCookies(),
    ],
  }) satisfies BetterAuthOptions;
