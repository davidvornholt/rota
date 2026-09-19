import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

let server: ViteDevServer;
const fixtureUrl = () => server.resolvedUrls?.local[0];

test.beforeAll(async ({ browserName }, testInfo) => {
  server = await Effect.runPromise(
    startGarmentFixtureServer(testInfo.outputPath('vite-cache', browserName)),
  );
});

test.afterAll(async () => {
  await Effect.runPromise(Effect.promise(() => server.close()));
});

test('your People shortcut opens your editable wardrobe and other administrators stay read-only', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/people.html`);
  const own = page.getByRole('link', { name: 'Open my wardrobe' });
  await expect(own).toHaveAttribute('href', '/wardrobe');
  await expect(
    page.getByRole('link', { name: 'View Sam’s wardrobe' }),
  ).toHaveAttribute('href', '/people/sam');
  await own.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Open my wardrobe');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'My editable wardrobe' }),
  ).toBeVisible();
});

test('access controls stay in a disclosure and keep explicit actions', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/people.html`);
  const recover = page.getByRole('button', { name: 'Issue recovery code' });
  await expect(recover).not.toBeVisible();
  await page.getByText('Manage access', { exact: true }).click();
  await expect(recover).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Suspend access' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('footer shortcuts expose names and tooltips to keyboard users', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/people.html?shell`);
  const footer = page.getByRole('contentinfo');
  const passkeys = footer.getByRole('link', { name: 'Passkeys' });
  await passkeys.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Passkeys');
  await page.keyboard.press('Tab');
  await expect(footer.getByRole('link', { name: 'People' })).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('People');
  await page.keyboard.press('Tab');
  await expect(footer.getByRole('button', { name: 'Sign out' })).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('Sign out');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
