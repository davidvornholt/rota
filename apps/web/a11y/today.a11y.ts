import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { Effect } from 'effect';
import type { ViteDevServer } from 'vite';
import { startGarmentFixtureServer } from './garment-fixture-server.ts';

let server: ViteDevServer;
const fixtureUrl = () => server.resolvedUrls?.local[0];

// Chromium's en-GB abbreviates September as "Sept", Node's as "Sep".
const threeDayPromptName =
  /^Friday 4 Sept? to Sunday 6 Sept?: what did you wear\?$/u;
const oneDayPromptName = /^Sunday 6 Sept?: same as Sat\?$/u;

test.beforeAll(async ({ browserName }, testInfo) => {
  server = await Effect.runPromise(
    startGarmentFixtureServer(testInfo.outputPath('vite-cache', browserName)),
  );
});

test.afterAll(async () => {
  await Effect.runPromise(Effect.promise(() => server.close()));
});

for (const failure of ['proxy', 'timeout'] as const) {
  test(`a ${failure} failure keeps the outfit and saved note, then clears on reroll`, async ({
    page,
  }) => {
    await page.route('**/fixture-note-save', (route) =>
      route.fulfill(
        failure === 'proxy'
          ? { status: 502, body: '' }
          : {
              status: 424,
              headers: {
                'content-type': 'text/plain',
                'x-tss-serialized': 'true',
              },
              body: 'Choosing an outfit timed out. Please try again.',
            },
      ),
    );
    await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?proposal`);
    await page.getByRole('button', { name: 'Add a note' }).click();
    await page
      .getByRole('textbox', { name: 'A word for the valet' })
      .fill('Meeting today');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(
      page.getByRole('heading', { name: 'One moment …' }),
    ).toBeVisible();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(
      failure === 'proxy'
        ? 'Refresh to check your outfit'
        : 'Choosing an outfit timed out',
    );
    await expect(alert).toContainText(
      'Your previous suggestion is still shown below.',
    );
    await expect(
      page.getByRole('heading', { name: 'Chinos and a shirt for today.' }),
    ).toBeVisible();
    await expect(
      page.getByText('Meeting today', { exact: true }),
    ).toBeVisible();
    const pick = page
      .getByRole('button', { name: 'Pick again', exact: true })
      .filter({ visible: true });
    await expect(pick).toBeEnabled();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
    await pick.click();
    await expect(
      page.getByRole('heading', { name: 'A fresh choice for your meeting.' }),
    ).toBeVisible();
    await expect(alert).toHaveCount(0);
    expect(await scanWcag22AaViolations(page)).toEqual([]);
  });
}

test('a run of blank days is announced with a way to fill them in or leave them', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?proposal&gap`);
  const prompt = page.getByRole('region', { name: threeDayPromptName });
  await expect(prompt.getByText('3 days without a log')).toBeVisible();
  const fill = prompt.getByRole('link', { name: 'Fill in 3 days' });
  await expect(fill).toHaveAttribute('href', '/history/catch-up');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await prompt.getByRole('button', { name: 'Leave it blank' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Chinos and a shirt for today.' }),
  ).toBeVisible();
});

test('one blank day is filled with a tap, or opens the catch-up page', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/today.html?proposal&gap=one`);
  const prompt = page.getByRole('region', { name: oneDayPromptName });
  await expect(
    prompt.getByRole('link', { name: 'Something else' }),
  ).toHaveAttribute('href', '/history/catch-up');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await prompt.getByRole('button', { name: 'Same as Sat' }).click();
  await expect(prompt).toHaveCount(0);
});

test('a failed automatic decision stays visible through refresh until retry or a new day state', async ({
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
