import { expect } from '@playwright/test';
import {
  issueCode,
  setAccess,
} from '../src/features/people/services/people-service.ts';
import {
  consumeAccessCode,
  resolveAccessCode,
} from '../src/shared/auth/access-codes.ts';
import {
  authPool,
  withAccessTransaction,
} from '../src/shared/auth/access-transaction.ts';
import { auth } from '../src/shared/auth/auth.ts';
import { pool } from '../src/shared/db/pool.ts';

export const expectRevoked = async (userId: string) => {
  expect(
    (await pool.query('select id from session where user_id = $1', [userId]))
      .rowCount,
  ).toBe(0);
};

const writePasskey = async (userId: string) =>
  (await auth.$context).adapter.create({
    model: 'passkey',
    data: {
      userId,
      credentialID: crypto.randomUUID(),
      publicKey: 'fixture',
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
    },
  });
const checkRollback = async (memberId: string, userId: string) => {
  await setAccess(memberId, true);
  await (await auth.$context).internalAdapter.createSession(userId);
  const recovery = await issueCode({ memberId });
  const serverError = 500;
  // Each attempt must leave the same recovery code and session intact.
  for (const failure of ['throw', 'response']) {
    const attempt = withAccessTransaction(async () => {
      await consumeAccessCode(recovery.code, userId);
      await writePasskey(userId);
      if (failure === 'throw') {
        throw new Error('Simulated persistence failure');
      }
      return new Response(null, { status: serverError });
    });
    // biome-ignore lint/performance/noAwaitInLoops: Sequential retries verify rollback preserves the same code.
    const outcome = await attempt.then(
      (response) => response.status,
      () => 'throw',
    );
    expect(outcome).toBe(failure === 'throw' ? 'throw' : serverError);
    expect((await resolveAccessCode(recovery.code)).id).toBe(userId);
    expect(
      (await pool.query('select id from session where user_id = $1', [userId]))
        .rowCount,
    ).toBe(1);
  }
  await consumeAccessCode(recovery.code, userId);
  await expect(consumeAccessCode(recovery.code, userId)).rejects.toThrow();
  // Failed/replayed requests released the lock and cannot strand later work.
  await setAccess(memberId, false);
};

/** Run only after family-check has verified its isolated local database. */
export const checkRevocation = async () => {
  const context = await auth.$context;
  const invite = await issueCode({ name: 'Revocation race fixture' });
  const member = await resolveAccessCode(invite.code);
  await consumeAccessCode(invite.code, member.id);
  try {
    for (const scenario of [
      'recovery-session',
      'recovery-passkey',
      'suspension-session',
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: Each interleaving resets and mutates the same account.
      await setAccess(invite.memberId, true);
      await writePasskey(member.id);
      await context.internalAdapter.createSession(member.id);
      const recovery = await issueCode({ memberId: invite.memberId });
      const verified = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<void>();
      // Pause at the actual adapter write used after WebAuthn/hook verification.
      const request = withAccessTransaction(async (client) => {
        const [{ pid }] = (
          await client.query<{ pid: number }>('select pg_backend_pid() as pid')
        ).rows;
        expect(
          (
            await authPool.query('select id from session where user_id = $1', [
              member.id,
            ])
          ).rowCount,
        ).toBeGreaterThan(0);
        verified.resolve(pid);
        await resume.promise;
        return scenario === 'recovery-passkey'
          ? writePasskey(member.id)
          : context.internalAdapter.createSession(member.id);
      });
      const writerPid = await verified.promise;
      const revocation =
        scenario === 'suspension-session'
          ? setAccess(invite.memberId, false)
          : consumeAccessCode(recovery.code, member.id);
      try {
        // Observe the competing database connection waiting, without timing sleeps.
        await expect
          .poll(
            async () =>
              (
                await pool.query(
                  'select 1 from pg_stat_activity where $1::int = any(pg_blocking_pids(pid))',
                  [writerPid],
                )
              ).rowCount,
          )
          .toBeGreaterThan(0);
      } finally {
        resume.resolve();
        await Promise.all([request, revocation]);
      }
      expect(
        (
          await pool.query('select id from session where user_id = $1', [
            member.id,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await pool.query('select id from passkey where user_id = $1', [
            member.id,
          ])
        ).rowCount,
      ).toBe(scenario === 'suspension-session' ? 1 : 0);
      await expect(resolveAccessCode(recovery.code)).rejects.toThrow();
    }
    await checkRollback(invite.memberId, member.id);
  } finally {
    await pool.query('delete from "user" where id = $1', [member.id]);
  }
};
