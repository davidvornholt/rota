import { Data, Effect } from 'effect';
import { codeDigest, newAccessCode } from '#/shared/auth/access-codes.ts';
import { currentIdentity } from '#/shared/auth/identity.ts';
import { pool } from '#/shared/db/pool.ts';

export class PeopleError extends Data.TaggedError('PeopleError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
export const requireAdmin = () => {
  const identity = currentIdentity();
  if (!identity.admin) {
    throw new PeopleError({ message: 'Administrator access is required.' });
  }
  return identity;
};
export const peopleOperation = <A>(work: () => Promise<A>) =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        requireAdmin();
        return await work();
      },
      catch: (cause) =>
        cause instanceof PeopleError
          ? cause
          : new PeopleError({
              message: 'The change could not be completed. Try again.',
              cause,
            }),
    }),
  );

export const issueCode = async (input: {
  readonly name?: string;
  readonly memberId?: string;
}) => {
  const client = await pool.connect();
  const code = newAccessCode();
  try {
    await client.query('begin');
    let id = input.memberId;
    if (id) {
      const member = await client.query(
        'select id from member where id = $1 and not admin and enabled for update',
        [id],
      );
      if (!member.rowCount) {
        throw new PeopleError({
          message: 'Only an active family account can be recovered.',
        });
      }
    } else {
      id = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await client.query(
        'insert into "user" (id, name, email) values ($1, $2, $3)',
        [userId, input.name, `${userId}@accounts.invalid`],
      );
      await client.query(
        'insert into member (id, user_id, name) values ($1, $2, $3)',
        [id, userId, input.name],
      );
    }
    await client.query(
      `insert into access_code (digest, member_id, kind, expires_at)
      values ($1, $2, $3, now() + interval '24 hours')
      on conflict (member_id) do update set digest = excluded.digest, kind = excluded.kind, expires_at = excluded.expires_at`,
      [await codeDigest(code), id, input.memberId ? 'recovery' : 'invitation'],
    );
    await client.query('commit');
    return { code, memberId: id };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

export const setAccess = async (id: string, enabled: boolean) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query<{ userId: string }>(
      'update member set enabled = $2 where id = $1 and not admin returning user_id as "userId"',
      [id, enabled],
    );
    const [member] = result.rows;
    if (!member) {
      throw new PeopleError({ message: 'This account cannot be changed.' });
    }
    if (!enabled) {
      await client.query('delete from session where user_id = $1', [
        member.userId,
      ]);
      await client.query('delete from access_code where member_id = $1', [id]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};
