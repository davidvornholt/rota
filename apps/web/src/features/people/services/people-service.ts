import { Effect, Schema } from 'effect';
import { codeDigest, newAccessCode } from '#/shared/auth/access-codes.ts';
import { withAccessTransaction } from '#/shared/auth/access-transaction.ts';
import { currentIdentity } from '#/shared/auth/identity.ts';

export class PeopleError extends Schema.TaggedError<PeopleError>()(
  'PeopleError',
  { message: Schema.String, cause: Schema.optional(Schema.Defect()) },
) {}
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

type AccessClient = Parameters<
  Parameters<typeof withAccessTransaction<unknown>>[0]
>[0];

/**
 * The member an earlier invitation with this ID created. The access lock
 * serializes invitations, so a twin that is still running has committed by the
 * time this runs.
 */
const storedInvitation = async (
  client: AccessClient,
  submissionId: string | undefined,
) => {
  if (submissionId === undefined) {
    return;
  }
  const result = await client.query<{ id: string }>(
    'select id from member where submission_id = $1',
    [submissionId],
  );
  return result.rows[0]?.id;
};

/**
 * Issues an invitation for `name`, or a recovery code for `memberId`. Sending
 * an invitation again with the same `submissionId`, for example after a lost
 * answer, creates no second member. Only the digest of a code is stored, so the
 * first code cannot be shown again: the repeat replaces it with a new code for
 * the same member.
 */
export const issueCode = async (input: {
  readonly name?: string;
  readonly memberId?: string;
  readonly submissionId?: string;
}) =>
  withAccessTransaction(async (client) => {
    const code = newAccessCode();
    const storedId = input.memberId
      ? undefined
      : await storedInvitation(client, input.submissionId);
    let id = input.memberId ?? storedId;
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
        'insert into member (id, user_id, name, submission_id) values ($1, $2, $3, $4)',
        [id, userId, input.name, input.submissionId ?? null],
      );
    }
    await client.query(
      `insert into access_code (digest, member_id, kind, expires_at)
      values ($1, $2, $3, now() + interval '24 hours')
      on conflict (member_id) do update set digest = excluded.digest, kind = excluded.kind, expires_at = excluded.expires_at`,
      [await codeDigest(code), id, input.memberId ? 'recovery' : 'invitation'],
    );
    return { code, memberId: id };
  });

export const setAccess = (id: string, enabled: boolean) =>
  withAccessTransaction(async (client) => {
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
  });
