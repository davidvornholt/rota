import { passkey } from '@better-auth/passkey';
import { APIError, getSessionFromCtx } from 'better-auth/api';
import { Duration } from 'effect';
import { pool } from '#/shared/db/pool.ts';
import { consumeAccessCode, resolveAccessCode } from './access-codes.ts';

const freshMilliseconds = Duration.toMillis(Duration.minutes(10));
export const familyPasskeys = (baseURL: string) =>
  passkey({
    rpName: 'Rota',
    rpID: new URL(baseURL).hostname,
    origin: new URL(baseURL).origin,
    registration: {
      requireSession: false,
      resolveUser: ({ context }) => resolveAccessCode(context ?? null),
      afterVerification: async ({ ctx, user, context }) => {
        if (context) {
          await consumeAccessCode(context, user.id);
        } else {
          const session = await getSessionFromCtx(ctx);
          if (
            !session ||
            session.user.id !== user.id ||
            Date.now() - session.session.createdAt.getTime() > freshMilliseconds
          ) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Sign in again before adding a passkey.',
            });
          }
          const result = await pool.query(
            `select 1 from member m join session s on s.user_id = m.user_id
          where m.user_id = $1 and m.enabled and s.token = $2 and s.expires_at > now()`,
            [user.id, session.session.token],
          );
          if (!result.rowCount) {
            throw new APIError('UNAUTHORIZED', {
              message: 'This account no longer has access.',
            });
          }
        }
        return { userId: user.id };
      },
    },
  });
