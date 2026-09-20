import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

const blueShirt = /^Blue Oxford shirt/u;
const accessories = /White trainers|Tan leather bag/u;
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

test('early laundry offers photos before selection, restores focus, and resets after sending', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Laundry', exact: true });
  await dialog
    .getByText('Send a piece to laundry early', { exact: true })
    .click();
  const choose = dialog.getByRole('button', {
    name: 'Choose a piece',
    exact: true,
  });
  await expect(
    dialog.getByRole('button', { name: 'Put in basket' }),
  ).toBeDisabled();
  await choose.click();
  const picker = page.getByRole('dialog', {
    name: 'Choose a piece',
    exact: true,
  });
  const shirt = picker.getByRole('button', { name: blueShirt });
  await expect(shirt.locator('img')).toBeVisible();
  await expect
    .poll(() =>
      shirt
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(picker.getByRole('button', { name: accessories })).toHaveCount(
    0,
  );
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(choose).toBeFocused();
  await expect(
    dialog.getByRole('button', { name: 'Put in basket' }),
  ).toBeDisabled();
  await choose.click();
  await shirt.click();
  const change = dialog.getByRole('button', {
    name: 'Change piece',
    exact: true,
  });
  await expect(change).toBeFocused();
  await expect(dialog.getByRole('region', { name: 'In laundry' })).toHaveCount(
    0,
  );
  await change.click();
  await expect(shirt).toHaveAttribute('aria-current', 'true');
  await picker.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(change).toBeFocused();
  await expect(
    dialog.getByRole('img', { name: 'Blue Oxford shirt', exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Put in basket' }).click();
  await expect(choose).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Put in basket' }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Back clean: Blue Oxford shirt' }),
  ).toBeVisible();
  await choose.click();
  await expect(shirt).toHaveCount(0);
  await picker.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
});

test('the laundry picker explains when no washable pieces remain', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Laundry', exact: true });
  await dialog
    .getByText('Send a piece to laundry early', { exact: true })
    .click();
  const picker = page.getByRole('dialog', {
    name: 'Choose a piece',
    exact: true,
  });
  const send = async (name: string) => {
    await dialog
      .getByRole('button', { name: 'Choose a piece', exact: true })
      .click();
    await picker.getByRole('button', { name, exact: false }).click();
    await dialog.getByRole('button', { name: 'Put in basket' }).click();
    await expect(
      dialog.getByRole('button', { name: `Back clean: ${name}`, exact: true }),
    ).toBeVisible();
  };
  await send('Navy chinos');
  await send('Blue Oxford shirt');
  await send('White cotton shirt');
  await dialog
    .getByRole('button', { name: 'Choose a piece', exact: true })
    .click();
  await expect(
    picker.getByText('No pieces available to send to laundry.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(
    dialog.getByRole('button', { name: 'Put in basket' }),
  ).toBeDisabled();
});

test('laundry shows photos in both lists and a fallback for garments without photos', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?returned`);
  await page
    .getByRole('button', { name: 'Send Navy chinos to laundry', exact: true })
    .click();
  await page.getByRole('button', { name: 'Laundry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const returned = dialog.getByRole('region', { name: 'Expected back' });
  const returnedPhoto = returned.locator('img');
  await expect(returnedPhoto).toBeVisible();
  await expect(returnedPhoto).toHaveAttribute(
    'src',
    '/a11y/fixtures/shirt.svg',
  );
  await expect(returnedPhoto).toHaveAttribute('alt', '');
  await expect
    .poll(() =>
      returnedPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const waiting = dialog.getByRole('region', { name: 'In laundry' });
  await expect(
    waiting.getByRole('listitem').filter({ hasText: 'Navy chinos' }),
  ).toBeVisible();
  await expect(waiting.locator('svg rect')).toHaveAttribute('fill', '#24364b');
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  await returned
    .getByRole('button', { name: 'Still in laundry: Blue Oxford shirt' })
    .click();
  await expect(returned).toHaveCount(0);
  await expect(waiting.locator('img')).toBeVisible();
  await expect(waiting.locator('img')).toHaveAttribute(
    'src',
    '/a11y/fixtures/shirt.svg',
  );
  await expect(
    waiting.getByText('Expected 8 Sept', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await waiting
    .getByRole('button', { name: 'Back clean: Blue Oxford shirt' })
    .click();
  await expect(
    waiting.getByRole('listitem').filter({ hasText: 'Blue Oxford shirt' }),
  ).toHaveCount(0);
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
    page.getByRole('button', { name: 'Suggest another', exact: true }),
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
    `${fixtureUrl()}a11y/fixtures/review-card.html?detail&completed&worn`,
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
  await expect(
    page.getByRole('button', { name: 'Mark clean', exact: true }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Back clean', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Send to laundry', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('My edited shirt');
});

test('marking a worn garment clean resets its counter, keeps history and edits, and hides the action', async ({
  page,
}) => {
  await page.goto(
    `${fixtureUrl()}a11y/fixtures/review-card.html?detail&completed&worn`,
  );
  const markClean = page.getByRole('button', {
    name: 'Mark clean',
    exact: true,
  });
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('My edited shirt');
  await expect(page.getByText('3 / 4', { exact: true })).toBeVisible();
  await markClean.focus();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page.getByText('0 / 4', { exact: true })).toBeVisible();
  await expect(markClean).toHaveCount(0);
  await expect(page.getByText('12×', { exact: true })).toBeVisible();
  await expect(page.getByText('7 Sept', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('My edited shirt');
  await expect(
    page.getByRole('button', { name: 'Send to laundry', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Back clean', exact: true }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('mark clean blocks duplicate care actions while saving and allows retry after failure', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/fixture-care-action', async (route) => {
    await gate;
    await route.abort('failed');
  });
  await page.goto(
    `${fixtureUrl()}a11y/fixtures/review-card.html?detail&completed&worn&care-failure`,
  );
  const markClean = page.getByRole('button', {
    name: 'Mark clean',
    exact: true,
  });
  await markClean.click();
  await expect(markClean).toBeDisabled();
  await expect(markClean).toHaveAttribute('aria-busy', 'true');
  await expect(
    page.getByRole('button', { name: 'Send to laundry', exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(markClean).toBeEnabled();
  await expect(page.getByText('3 / 4', { exact: true })).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.route('**/fixture-care-action', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await markClean.click();
  await expect(page.getByText('0 / 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
