import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

const whiteShirt = /^White cotton shirt/u;

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

test('early laundry previews the selected photograph and resets after sending', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByText('Send a piece to laundry early', { exact: true })
    .click();
  await dialog
    .getByRole('combobox', { name: 'Piece', exact: true })
    .selectOption('demo-shirt');
  await expect(
    dialog.getByRole('img', { name: 'Blue Oxford shirt', exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Put in basket' }).click();
  await expect(
    dialog.getByRole('combobox', { name: 'Piece', exact: true }),
  ).toHaveValue('');
  await expect(
    dialog.getByRole('button', { name: 'Back clean: Blue Oxford shirt' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
});

test('sending a proposed garment keeps other draft choices and leaves replacement manual after reload', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await page
    .getByRole('button', { name: 'Send Navy chinos to laundry', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Complete outfit', exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('sending a worn garment retains the logged outfit through reload', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Wear this', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Send Blue Oxford shirt to laundry',
      exact: true,
    })
    .click();
  await expect(
    page.getByText('In laundry · back 11 Sept', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Today, dressed.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', {
      name: 'Send Blue Oxford shirt to laundry',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeDisabled();
  await expect(
    page.getByText('In laundry · back 11 Sept', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('a failed laundry request preserves the draft, prevents duplicate actions while busy, and can be retried', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/fixture-planning-action', async (route) => {
    await gate;
    await route.fulfill({ status: 502, body: '' });
  });
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?failure`);
  const send = page.getByRole('button', {
    name: 'Send Blue Oxford shirt to laundry',
    exact: true,
  });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeEnabled();
  await page.route('**/fixture-planning-action', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await send.click();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('garment care stays on details, preserves edits, and switches to one back-clean action', async ({
  page,
}) => {
  await page.goto(
    `${fixtureUrl()}a11y/fixtures/review-card.html?detail&completed`,
  );
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('My edited shirt');
  await expect(
    page.getByRole('link', { name: 'Laundry', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Send to laundry', exact: true })
    .click();
  await expect(
    page.getByText('In laundry · back 11 Sept', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('My edited shirt');
  await expect(
    page.getByRole('button', { name: 'Send to laundry', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Back clean', exact: true }),
  ).toHaveCount(1);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Back clean', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Send to laundry', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('My edited shirt');
});
