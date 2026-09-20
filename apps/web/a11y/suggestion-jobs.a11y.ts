import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

let server: ViteDevServer;
const fixtureUrl = () =>
  `${server.resolvedUrls?.local[0]}a11y/fixtures/today.html?job-network`;
test.beforeAll(async ({ browserName }, testInfo) => {
  server = await Effect.runPromise(
    startGarmentFixtureServer(testInfo.outputPath('vite-cache', browserName)),
  );
});
test.afterAll(async () => {
  await Effect.runPromise(Effect.promise(() => server.close()));
});

const choosing = /Choosing an outfit/u;
const complete = /Outfit suggested/u;
const whiteShirt = /^White cotton shirt/u;

test('a slow suggestion announces progress and resumes after reload without starting another job', async ({
  page,
}) => {
  let ready = false;
  let starts = 0;
  await page.route('**/fixture-suggestion-start', (route) => {
    starts += 1;
    return route.fulfill({ json: {} });
  });
  await page.route('**/fixture-suggestion-status', (route) =>
    route.fulfill({ json: { status: ready ? 'succeeded' : 'running' } }),
  );
  await page.goto(fixtureUrl());
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: choosing }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: choosing }),
  ).toBeVisible();
  expect(starts).toBe(1);
  ready = true;
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White trainers' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeEnabled();
  expect(starts).toBe(1);
});

test('a lost start response retries the same request id and completes once', async ({
  page,
}) => {
  const ids: Array<string> = [];
  await page.route('**/fixture-suggestion-start', async (route) => {
    ids.push(route.request().postDataJSON().requestId);
    if (ids.length === 1) {
      await route.abort('connectionreset');
    } else {
      await route.fulfill({ json: {} });
    }
  });
  await page.route('**/fixture-suggestion-status', (route) =>
    route.fulfill({ json: { status: 'succeeded' } }),
  );
  await page.goto(fixtureUrl());
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBeTruthy();
  expect(new Set(ids).size).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Change White trainers' }),
  ).toBeVisible();
});

test('a temporary status connection failure retries without another generation', async ({
  page,
}) => {
  let starts = 0;
  let polls = 0;
  await page.route('**/fixture-suggestion-start', (route) => {
    starts += 1;
    return route.fulfill({ json: {} });
  });
  await page.route('**/fixture-suggestion-status', async (route) => {
    polls += 1;
    if (polls === 1) {
      await route.abort('connectionreset');
    } else {
      await route.fulfill({ json: { status: 'succeeded' } });
    }
  });
  await page.goto(fixtureUrl());
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  expect(starts).toBe(1);
  expect(polls).toBe(2);
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeEnabled();
});

test('a failed suggestion preserves manually chosen pieces and permits an explicit retry', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/fixture-suggestion-start', (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route('**/fixture-suggestion-status', (route) =>
    route.fulfill({ json: { status: failed ? 'failed' : 'succeeded' } }),
  );
  await page.goto(fixtureUrl());
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page
    .getByRole('button', { name: 'Suggest around kept pieces' })
    .click();
  await expect(
    page.getByText(
      'Choosing an outfit timed out. Your current outfit is unchanged. Try again.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Suggest around kept pieces' }),
  ).toBeEnabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  failed = false;
  await page
    .getByRole('button', { name: 'Suggest around kept pieces' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(page.getByText('Worn today', { exact: true })).toHaveCount(0);
});

test('recovering a completed job keeps a newer manually saved outfit', async ({
  page,
}) => {
  let requestId = '';
  let starts = 0;
  await page.route('**/fixture-suggestion-start', (route) => {
    starts += 1;
    ({ requestId } = route.request().postDataJSON());
    return route.fulfill({ json: {} });
  });
  await page.route('**/fixture-suggestion-status', (route) =>
    route.fulfill({ json: { status: 'succeeded' } }),
  );
  await page.goto(fixtureUrl());
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.evaluate(
    (id) => sessionStorage.setItem('rota-suggestion-2026-09-07', id),
    requestId,
  );
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: complete }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toHaveCount(0);
  expect(starts).toBe(1);
});
