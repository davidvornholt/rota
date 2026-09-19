import { APIError } from 'better-auth/api';
import { pool } from '#/shared/db/pool.ts';

const hexRadix = 16;
const hexDigits = 2;
const codeBytes = 32;
const maxCodeLength = 100;
export const codeDigest = async (code: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code.trim()),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(hexRadix).padStart(hexDigits, '0'),
  ).join('');
};
export const newAccessCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(codeBytes));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};
export const invalidCode = () =>
  new APIError('BAD_REQUEST', {
    message: 'This code is invalid or expired. Ask David for a new one.',
  });

export const resolveAccessCode = async (code: string | null) => {
  if (!code || code.length > maxCodeLength) {
    throw invalidCode();
  }
  const result = await pool.query<{ userId: string; name: string }>(
    `
    select m.user_id as "userId", m.name from access_code c join member m on m.id = c.member_id
    where c.digest = $1 and c.expires_at > now() and m.enabled and not m.admin
  `,
    [await codeDigest(code)],
  );
  const [member] = result.rows;
  if (!member) {
    throw invalidCode();
  }
  return { id: member.userId, name: member.name, displayName: member.name };
};

/** Consume only after WebAuthn verification. Concurrent redemption has exactly one winner. */
export const consumeAccessCode = async (code: string, userId: string) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query<{ kind: string }>(
      `
      delete from access_code c using member m
      where c.member_id = m.id and c.digest = $1 and c.expires_at > now()
        and m.user_id = $2 and m.enabled and not m.admin returning c.kind
    `,
      [await codeDigest(code), userId],
    );
    if (!result.rows[0]) {
      throw invalidCode();
    }
    if (result.rows[0].kind === 'recovery') {
      await client.query('delete from session where user_id = $1', [userId]);
      await client.query('delete from passkey where user_id = $1', [userId]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};
