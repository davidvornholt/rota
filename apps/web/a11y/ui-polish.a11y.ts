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

test('clean-top toggles immediately and persists the latest choice after a slow save', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/fixture-planning-action', async (route) => {
    await response;
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow&failure`);
  const toggle = page.getByRole('checkbox', {
    name: 'Freshly washed top tomorrow',
  });
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  release?.();
  await expect(
    page.getByRole('button', { name: 'Save for tomorrow', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(toggle).not.toBeChecked();
});

test('failed clean-top saves restore the previous choice and expose the error', async ({
  page,
}) => {
  await page.route('**/fixture-planning-action', (route) =>
    route.fulfill({ status: 502, body: '' }),
  );
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow&failure`);
  const toggle = page.getByRole('checkbox', {
    name: 'Freshly washed top tomorrow',
  });
  await toggle.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(toggle).not.toBeChecked();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('notes are visible without a disclosure and keeping a piece does not move its control', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow`);
  const note = page.getByRole('textbox', {
    name: 'Plans for the day (optional)',
  });
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('rows', '3');
  await note.fill('Office, then dinner');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save note', exact: true }),
  ).toHaveCount(0);
  const keep = page.getByRole('checkbox', { name: 'Keep this piece' }).first();
  await keep.scrollIntoViewIfNeeded();
  const before = await keep.boundingBox();
  await keep.check();
  await expect(
    page.getByRole('button', { name: 'Complete outfit', exact: true }),
  ).toBeVisible();
  const after = await keep.boundingBox();
  expect(Math.round(after?.y ?? 0)).toBe(Math.round(before?.y ?? 0));
  await page.reload();
  await expect(note).toHaveValue('Office, then dinner');
});

test('compact dialogs have no nested scroll area and tooltips do not create overflow', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/icon-actions.html`);
  await page.getByRole('button', { name: 'Edit occasion note' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toBeVisible();
  expect(
    await dialog.evaluate((element) => ({
      overflows: element.scrollHeight > element.clientHeight,
      nested: [...element.querySelectorAll('*')].some(
        (child) => getComputedStyle(child).overflowY === 'auto',
      ),
    })),
  ).toEqual({ overflows: false, nested: false });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
});

test('reduced motion disables modal animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${fixtureUrl()}a11y/fixtures/icon-actions.html`);
  await page.getByRole('button', { name: 'Edit occasion note' }).click();
  await expect(
    page.getByRole('dialog').locator(':scope > div').first(),
  ).toHaveCSS('animation-name', 'none');
});

test('tooltip remains readable when the pointer moves onto it', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/icon-actions.html`);
  await page.getByRole('button', { name: 'Edit occasion note' }).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
});

test('wearing is primary, suggesting is labelled, and saving is behind a keyboard-accessible disclosure', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  const wear = page.getByRole('button', { name: 'Wear this', exact: true });
  await expect(wear.locator('..').getByRole('button').first()).toHaveText(
    'Wear this',
  );
  await expect(
    page.getByRole('button', { name: 'Suggest another', exact: true }),
  ).toHaveText('Suggest another');
  await expect(
    page.getByRole('button', { name: 'Save for later today', exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Save as an outfit', exact: true }),
  ).toBeHidden();
  const more = page.getByText('More options', { exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Save for later today', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save as an outfit', exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Save as an outfit', exact: true }),
  ).toBeHidden();
});
