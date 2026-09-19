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

const whiteShirt = /^White cotton shirt/u;
const badGateway = 502;
const success = 200;

test('manual tomorrow choices save independently of reusable outfits and never record wear', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow`);
  await expect(
    page.getByRole('link', { name: 'Today', exact: true }),
  ).toContainText('7 Sept');
  await expect(
    page.getByRole('link', { name: 'Tomorrow', exact: true }),
  ).toContainText('8 Sept');
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await expect(page.getByRole('button', { name: 'Wear this' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeVisible();
  await expect(page.getByText('Worn today', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Tomorrow', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Saved outfits', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Blue and navy' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('incomplete and empty daily plans survive reload without resurrecting the previous suggestion', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Remove top', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Navy chinos' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear this' })).toHaveCount(0);
  await expect(page.getByText('Worn today', { exact: true })).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('kept pieces constrain the next suggestion but keeping resets after reopening', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  const keep = page
    .getByRole('region', { name: 'Top', exact: true })
    .getByRole('checkbox', { name: 'Keep when suggesting' });
  await expect(keep).toBeChecked();
  await expect(
    page.getByText(
      'Checked pieces stay in your next suggestion. Keeping a piece does not record wear.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Suggest around kept pieces' })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.reload();
  await expect(keep).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeVisible();
});

test('slow autosaves keep selection responsive and persist the latest edit in order', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/fixture-planning-action', async (route) => {
    const data = route.request().postDataJSON();
    if (data.change.action === 'plan') {
      requests += 1;
      if (requests === 1) {
        await pending;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?failure`);
  await page.getByRole('button', { name: 'Remove top', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText('Saving');
  await expect(
    page.getByRole('button', { name: 'Remove bottom', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Today', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  release?.();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  expect(requests).toBe(2);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
});

test('failed autosaves preserve edits, explain the failure, and persist after retry', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/fixture-planning-action', (route) =>
    route.fulfill({
      status: fail ? badGateway : success,
      contentType: 'application/json',
      body: fail ? '' : '{}',
    }),
  );
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?tomorrow&failure`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Could not save',
  );
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry save', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const unsaved = page.getByRole('dialog', { name: 'Leave without saving?' });
  await expect(unsaved).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await unsaved.getByRole('button', { name: 'Stay here', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tomorrow starts here.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
});
