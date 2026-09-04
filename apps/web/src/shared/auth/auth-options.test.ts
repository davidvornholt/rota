import { describe, expect, it } from 'bun:test';
import { symmetricEncrypt } from 'better-auth/crypto';
import { decryptOAuthToken, setTokenUtil } from 'better-auth/oauth2';

import { createAuthOptions } from './auth-options.ts';

const providerToken = 'github-provider-token';
const testSecret = 'oauth-test-secret-with-at-least-32-characters';
const allowedGitHubAccountId = '157214705';
const otherGitHubAccountId = '999999999';

const authOptions = createAuthOptions({
  allowedGitHubAccountId,
  baseURL: 'http://localhost:3000',
  githubClientId: 'test-client-id',
  githubClientSecret: 'test-client-secret',
  secret: testSecret,
});

const tokenContext = {
  options: { account: authOptions.account },
  secretConfig: testSecret,
} as unknown as Parameters<typeof setTokenUtil>[1];

describe('account allowlist wiring', () => {
  const githubSource = (id: number) => ({
    action: 'sign-in' as const,
    method: 'oauth' as const,
    oauth: { providerId: 'github', profile: { id, login: 'davidvornholt' } },
  });

  it('installs the gate on the option better-auth consults, not on the profile mapper', () => {
    expect(
      authOptions.user.validateUserInfo({
        source: githubSource(Number(allowedGitHubAccountId)),
      }),
    ).toBeUndefined();
    expect(
      authOptions.user.validateUserInfo({
        source: githubSource(Number(otherGitHubAccountId)),
      }),
    ).not.toBeUndefined();
    expect(authOptions.socialProviders.github).not.toHaveProperty(
      'mapProfileToUser',
    );
  });
});

describe('OAuth token persistence', () => {
  it('encrypts a provider token before persistence and decrypts it for use', async () => {
    const persisted = await setTokenUtil(providerToken, tokenContext);
    if (!persisted) {
      throw new Error('better-auth did not return an encrypted token.');
    }
    expect(persisted).not.toBe(providerToken);
    expect(await decryptOAuthToken(persisted, tokenContext)).toBe(
      providerToken,
    );
  });

  it('keeps existing plaintext rows readable until the next token update', async () => {
    expect(await decryptOAuthToken(providerToken, tokenContext)).toBe(
      providerToken,
    );
  });

  it('uses the same ciphertext envelope as the configured encryption utility', async () => {
    const persisted = await symmetricEncrypt({
      key: testSecret,
      data: providerToken,
    });
    expect(await decryptOAuthToken(persisted, tokenContext)).toBe(
      providerToken,
    );
  });
});
