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

test('edit and delete icons preserve dialog dismissal and explicit confirmation', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/icon-actions.html`);
  const edit = page.getByRole('button', { name: 'Edit occasion note' });
  await edit.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Edit occasion note');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Change the note' }),
  ).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const close = dialog.getByRole('button', { name: 'Close' });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('Close');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(edit).toBeFocused();
  await edit.click();
  await page
    .getByRole('textbox', { name: 'A word for the valet' })
    .fill('Office');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Office', { exact: true })).toBeVisible();
  const remove = page.getByRole('button', {
    name: 'Delete garment',
    exact: true,
  });
  await remove.click();
  await expect(page.getByText('Garment deleted', { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await page.getByRole('button', { name: 'Delete for good' }).click();
  await expect(
    page.getByText('Garment deleted', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('image close icon dismisses the enlarged picture and restores focus', async ({
  page,
}) => {
  await page.goto(
    `${fixtureUrl()}a11y/fixtures/review-card.html?detail&completed`,
  );
  const show = page
    .getByRole('button', { name: 'Show Blue Oxford shirt large' })
    .first();
  await show.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Opened by a click, so nothing in the dialog should start out explained.
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('Close');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(show).toBeFocused();
});
