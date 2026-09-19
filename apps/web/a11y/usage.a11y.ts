import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

let server: ViteDevServer;
test.beforeAll(async ({ browserName }, testInfo) => {
  server = await Effect.runPromise(
    startGarmentFixtureServer(testInfo.outputPath('vite-cache', browserName)),
  );
});
test.afterAll(async () => {
  await server.close();
});
test('usage explains reference estimates without editable price controls', async ({
  page,
}) => {
  await page.goto(`${server.resolvedUrls?.local[0]}a11y/fixtures/usage.html`);
  await expect(page.getByText('Alex')).toBeVisible();
  await expect(
    page.getByText('Foundry image costs use OpenAI reference rates', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save prices' })).toHaveCount(
    0,
  );
  await page.getByLabel('Period').selectOption('7');
  await expect(page.getByText('Alex')).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
