import { describe, expect, it } from 'bun:test';
import type {
  ValidateUserInfoAction,
  ValidateUserInfoSource,
} from 'better-auth';

import { authorizeSession, createGitHubAccountGate } from './authorization.ts';

const allowedAccountId = '157214705';
const session = { user: { name: 'David' } };

const gate = createGitHubAccountGate(allowedAccountId);

/** Every point at which better-auth consults the gate during GitHub sign-in. */
const actions: ReadonlyArray<ValidateUserInfoAction> = [
  'create-user',
  'link-account',
  'sign-in',
];

const githubSource = (
  action: ValidateUserInfoAction,
  profile: Record<string, unknown>,
): ValidateUserInfoSource => ({
  action,
  method: 'oauth',
  oauth: { providerId: 'github', profile },
});

describe('GitHub account gate', () => {
  it('admits the configured account at every provisioning point', () => {
    for (const action of actions) {
      expect(
        gate({
          source: githubSource(action, {
            id: Number(allowedAccountId),
            login: 'davidvornholt',
          }),
        }),
      ).toBeUndefined();
    }
  });

  it('rejects a different account ID at every provisioning point, so a returning sign-in is re-checked', () => {
    for (const action of actions) {
      expect(
        gate({
          source: githubSource(action, {
            id: 999_999_999,
            login: 'davidvornholt',
          }),
        }),
      ).toEqual({
        error: 'account_not_allowed',
        errorDescription: 'This application is private.',
      });
    }
  });

  it('rejects a profile whose ID is missing or not a scalar', () => {
    for (const profile of [
      { login: 'davidvornholt' },
      { id: null },
      { id: {} },
      { id: [allowedAccountId] },
    ]) {
      expect(
        gate({ source: githubSource('sign-in', profile) }),
      ).not.toBeUndefined();
    }
  });

  it('rejects any other provider or sign-in method', () => {
    expect(
      gate({
        source: {
          action: 'create-user',
          method: 'oauth',
          oauth: { providerId: 'gitlab', profile: { id: allowedAccountId } },
        },
      }),
    ).not.toBeUndefined();
    expect(
      gate({ source: { action: 'create-user', method: 'email-password' } }),
    ).not.toBeUndefined();
  });

  it('produces a rejection code that survives a URL round trip', () => {
    const rejection = gate({
      source: githubSource('sign-in', { id: 999_999_999 }),
    });
    const code = rejection?.error ?? '';
    expect(new URLSearchParams({ error: code }).get('error')).toBe(code);
    expect(encodeURIComponent(code)).toBe(code);
  });
});

describe('GitHub session authorization', () => {
  it('accepts a session linked to the configured GitHub account', async () => {
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(session),
      getAccounts: () =>
        Promise.resolve([
          { providerId: 'github', accountId: allowedAccountId },
        ]),
      revokeSession: () => Promise.reject(new Error('must not revoke')),
    });
    expect(result).toBe(session);
  });

  it('revokes a session linked to a different account ID', async () => {
    let revoked = false;
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(session),
      getAccounts: () =>
        Promise.resolve([{ providerId: 'github', accountId: '999999999' }]),
      revokeSession: () => {
        revoked = true;
        return Promise.resolve();
      },
    });
    expect(result).toBeNull();
    expect(revoked).toBeTrue();
  });

  it('does not query accounts without a session', async () => {
    let queriedAccounts = false;
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(null),
      getAccounts: () => {
        queriedAccounts = true;
        return Promise.resolve([]);
      },
      revokeSession: () => Promise.resolve(),
    });
    expect(result).toBeNull();
    expect(queriedAccounts).toBeFalse();
  });
});
