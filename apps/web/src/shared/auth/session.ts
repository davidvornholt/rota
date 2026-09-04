import { auth } from '#/shared/auth/auth.ts';
import { env } from '#/shared/env.ts';
import { authorizeSession } from './authorization.ts';

/**
 * True when the request carries a live better-auth session that belongs to the
 * one allowed GitHub account. Nothing reads the session payload yet, so only
 * the verdict crosses this boundary.
 */
export const hasAuthorizedSession = async (
  headers: Headers,
): Promise<boolean> => {
  const session = await authorizeSession({
    allowedAccountId: env.GITHUB_ALLOWED_ACCOUNT_ID,
    getSession: () => auth.api.getSession({ headers }),
    getAccounts: () => auth.api.listUserAccounts({ headers }),
    revokeSession: () => auth.api.signOut({ headers }),
  });
  return session !== null;
};
