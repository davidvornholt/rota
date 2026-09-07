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

test('a returned decision problem stays visible through an unchanged loader refresh', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html`);
  const calls = page.getByRole('status', { name: 'Decision calls' });
  const loader = page.getByRole('status', { name: 'Loader calls' });
  await expect(loader).toHaveText('2');
  await expect(calls).toHaveText('1');
  const retry = page.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(loader).toHaveText('3');
  await expect(calls).toHaveText('1');
  await expect(
    page.getByText('Try the valet again.', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await retry.click();
  await expect(loader).toHaveText('4');
  await expect(calls).toHaveText('2');
  await expect(retry).toBeEnabled();
  await page.getByRole('button', { name: 'Show logged day' }).click();
  await expect(loader).toHaveText('5');
  await page.getByRole('button', { name: 'Show undecided day' }).click();
  await expect(loader).toHaveText('7');
  await expect(calls).toHaveText('3');
  await expect(retry).toBeEnabled();
});
