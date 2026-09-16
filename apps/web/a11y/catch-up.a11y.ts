import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

let server: ViteDevServer;
const fixtureUrl = () => server.resolvedUrls?.local[0];

// Chromium's en-GB long date carries a comma after the weekday; Node's does not.
const fridayName = /^Friday,? 4 September 2026$/u;
const saturdayName = /^Saturday,? 5 September 2026$/u;
const fridayBottomChinos = /^Bottom Navy chinos/u;
const fridayTopShirt = /^Top Blue Oxford shirt/u;
const fridayBottomBlank = /^Bottom Not logged/u;
const topSlot = /^Top/u;
const topWhiteTee = /^Top White tee/u;
const oxfordShirtTile = /^Blue Oxford shirt/u;
const whiteTeeTile = /^White tee/u;

test.beforeAll(async ({ browserName }, testInfo) => {
  server = await Effect.runPromise(
    startGarmentFixtureServer(testInfo.outputPath('vite-cache', browserName)),
  );
});

test.afterAll(async () => {
  await Effect.runPromise(Effect.promise(() => server.close()));
});

test('blank days copy from the day before and save together, leaving cleared days blank', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/catch-up.html`);
  await expect(
    page.getByRole('heading', { level: 1, name: '3 days without a log' }),
  ).toBeVisible();
  const friday = page.getByRole('group', { name: fridayName });
  const saturday = page.getByRole('group', { name: saturdayName });
  await expect(friday.getByText('Occasion: Team offsite')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  const sameAsFriday = saturday.getByRole('button', { name: 'Same as Friday' });
  await expect(sameAsFriday).toBeDisabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  await friday.getByRole('button', { name: 'Same as Thursday' }).click();
  await expect(
    friday.getByRole('button', { name: fridayBottomChinos }),
  ).toBeVisible();
  await expect(
    friday.getByRole('button', { name: fridayTopShirt }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save 1 day' })).toBeEnabled();

  await sameAsFriday.click();
  const saturdayTop = saturday.getByRole('button', { name: topSlot });
  await saturdayTop.click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading', { name: 'Top' })).toBeFocused();
  await expect(picker.getByText(saturdayName)).toBeVisible();
  await expect(
    picker.getByRole('button', { name: oxfordShirtTile }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(
    picker.getByRole('button', { name: 'Not logged' }),
  ).not.toHaveAttribute('aria-current', 'true');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await picker.getByRole('button', { name: whiteTeeTile }).click();
  await expect(picker).toHaveCount(0);
  await expect(saturdayTop).toHaveAccessibleName(topWhiteTee);
  await expect(saturdayTop).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save 2 days' })).toBeVisible();

  await friday.getByRole('button', { name: 'Clear' }).click();
  await expect(
    friday.getByRole('button', { name: fridayBottomBlank }),
  ).toBeVisible();
  await expect(sameAsFriday).toBeDisabled();
  await page.getByRole('button', { name: 'Save 1 day' }).click();
  await expect(page.getByRole('status', { name: 'Saved days' })).toHaveText(
    JSON.stringify([
      {
        date: '2026-09-05',
        entries: [
          { garmentId: 'demo-chinos', slot: 'bottom' },
          { garmentId: 'demo-tee', slot: 'top' },
        ],
      },
    ]),
  );
});

for (const mode of ['empty', 'fresh'] as const) {
  test(`a wardrobe with nothing to catch up on (${mode}) says so`, async ({
    page,
  }) => {
    await page.goto(`${fixtureUrl()}a11y/fixtures/catch-up.html?${mode}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nothing to catch up on' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        mode === 'fresh'
          ? 'Nothing is logged yet.'
          : 'Every day up to yesterday is logged.',
      ),
    ).toBeVisible();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
  });
}
