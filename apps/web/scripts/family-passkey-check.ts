// biome-ignore lint/correctness/noUnresolvedImports: Biome cannot resolve Playwright's re-exports; TypeScript and the browser run verify these exports.
import { type CDPSession, expect, type Page } from '@playwright/test';
import { pool } from '../src/shared/db/database.ts';

/** Expects the passkey page to be open in a session that just started. */
export const checkAddedPasskey = async (
  {
    page,
    cdp,
    authenticatorId,
  }: {
    readonly page: Page;
    readonly cdp: CDPSession;
    readonly authenticatorId: string;
  },
  userId: string,
) => {
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const add = page.getByRole('button', { name: 'Add a passkey', exact: true });
  const ageSession = (interval: string) =>
    pool.query(
      'update session set created_at = created_at - $2::interval where user_id = $1',
      [userId, interval],
    );
  await ageSession('11 minutes');
  await add.click();
  await expect(
    page.getByText('Sign out and sign in again', { exact: false }),
  ).toBeVisible();
  await ageSession('-11 minutes');
  // Adding from the same page proves the older session was not sent away.
  await add.click();
  await expect(page.getByRole('status')).toHaveText('Passkey added.');
};
