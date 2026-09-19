import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

const whiteShirt = /^White cotton shirt/u;
const trainers = /^White trainers/u;
const bag = /^Tan leather bag/u;
const blueShirt = /^Blue Oxford shirt/u;
const chinos = /^Navy chinos/u;
const badGateway = 502;
const failedDependency = 424;
const failedStatuses = [badGateway, failedDependency];

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

test('saving a history outfit leaves the recorded day unchanged', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/history.html`);
  await page.getByRole('button', { name: 'Save as an outfit' }).click();
  await page.getByLabel('Outfit name').fill('A favourite day');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Save outfit', exact: true }).click();
  await expect(
    page.getByText('Saved to your outfits.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Day saves')).toHaveText('0');
  await expect(
    page.getByRole('button', { name: 'Save the day' }),
  ).toBeDisabled();
});

test('tomorrow saves a plan, keeps it across day navigation and never logs it early', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow`);
  await expect(page.getByRole('button', { name: 'Wear this' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Save for tomorrow', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Saved for tomorrow' }),
  ).toBeDisabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeVisible();
  await page.getByRole('link', { name: 'Tomorrow', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Saved for tomorrow' }),
  ).toBeDisabled();
});

test('a chosen top stays while Rota completes the outfit, with optional shoes and bag', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Choose top' }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: whiteShirt }).click();
  await expect(
    page
      .getByRole('region', { name: 'Top', exact: true })
      .getByRole('checkbox', { name: 'Keep' }),
  ).toBeChecked();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await page.getByRole('button', { name: 'Complete outfit' }).click();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Navy chinos' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add shoes' }).click();
  await dialog.getByRole('button', { name: trainers }).click();
  await page.getByRole('button', { name: 'Add bag' }).click();
  await dialog.getByRole('button', { name: bag }).click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('saved outfits can be created, chosen, edited independently and deleted explicitly', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow`);
  await page.getByRole('button', { name: 'Save as an outfit' }).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Outfit name' })
    .fill('Office favourite');
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Saved outfits', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  const outfit = dialog
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Office favourite' }) });
  await outfit.getByRole('button', { name: 'Choose for tomorrow' }).click();
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await page
    .getByRole('button', { name: 'Saved outfits', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit Office favourite' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Outfit name' }).fill('Office blue');
  await page.getByRole('button', { name: 'Save outfit', exact: true }).click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page
    .getByRole('button', { name: 'Delete Office blue', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Office blue' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete outfit', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Office blue' })).toHaveCount(
    0,
  );
});

test('laundry is a bulk action and unavailable pieces cannot be worn', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: blueShirt }).check();
  await dialog.getByRole('checkbox', { name: chinos }).check();
  await dialog.getByRole('button', { name: 'Put in laundry' }).click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeDisabled();
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  await dialog.getByRole('button', { name: 'Select worn' }).click();
  await dialog.getByRole('button', { name: 'Mark washed' }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeEnabled();
});

for (const status of failedStatuses) {
  test(`a ${status} suggestion failure preserves selected pieces and recovers on retry`, async ({
    page,
  }) => {
    await page.route('**/fixture-planning-action', (route) =>
      route.fulfill({ status, body: '' }),
    );
    await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?failure`);
    await page.getByRole('button', { name: 'Suggest another' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wear this' })).toBeEnabled();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
    await page.route('**/fixture-planning-action', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.getByRole('button', { name: 'Suggest another' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('a saved outfit chosen after logging today opens tomorrow without changing today', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Wear this' }).click();
  await expect(
    page.getByRole('heading', { name: 'Today, dressed.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Saved outfits', exact: true })
    .click();
  await page.getByRole('button', { name: 'Choose for tomorrow' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tomorrow starts here.' }),
  ).toBeVisible();
  await expect(page.getByText('Based on Blue and navy')).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Today, dressed.' }),
  ).toBeVisible();
});

test('clean-top cadence can be set and cleared without accessory wash budgets', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/settings.html`);
  const start = page.getByLabel('Clean top every other day, starting');
  await start.fill('2026-09-19');
  await page.getByRole('button', { name: 'Save rotation settings' }).click();
  await expect(start).toHaveValue('2026-09-19');
  await expect(
    page.getByRole('spinbutton', { name: 'shoes', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('spinbutton', { name: 'handbag', exact: true }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await start.fill('');
  await page.getByRole('button', { name: 'Save rotation settings' }).click();
  await expect(start).toHaveValue('');
});
