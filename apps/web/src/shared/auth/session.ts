import { auth } from '#/shared/auth/auth.ts';
import { pool } from '#/shared/db/pool.ts';
import { env } from '#/shared/env.ts';
import type { Identity } from './identity.ts';

export const authorizedIdentity = async (
  headers: Headers,
): Promise<Identity | null> => {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  await ensureOwner();
  const result = await pool.query<Identity>(
    `update member set last_active_at = now()
    where user_id = $1 and enabled and (admin or exists (select 1 from passkey where user_id = $1))
    returning id, user_id as "userId", name, admin`,
    [session.user.id],
  );
  return result.rows[0] ?? null;
};

export const hasAuthorizedSession = async (
  headers: Headers,
): Promise<boolean> => (await authorizedIdentity(headers)) !== null;

/** Bootstrap from the existing trusted account even before its first post-upgrade visit. */
export const ensureOwner = async () => {
  await pool.query(
    `insert into member (id, user_id, name, admin)
    select 'personal', u.id, u.name, true from "user" u join account a on a.user_id = u.id
    where a.provider_id = 'github' and a.account_id = $1
    on conflict (id) do nothing`,
    [env.GITHUB_ALLOWED_ACCOUNT_ID],
  );
};
