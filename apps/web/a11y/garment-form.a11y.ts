import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { Effect } from 'effect';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
const fixtureUrl = () => server.resolvedUrls?.local[0];
const warmthLabels = ['Light', 'Medium', 'Heavy'];
const formalityLabels = ['Casual', 'Smart', 'Formal'];
const lightHelp = /Little insulation/u;
const mediumHelp = /Some insulation/u;
const formalHelp = /Dressy occasion clothing/u;

// Exercise the shared form with React and the real theme without bypassing
// authentication or adding test routes to the production application.
test.beforeAll(async () => {
  server = await Effect.runPromise(
    Effect.promise(() =>
      createServer({
        configFile: false,
        root: new URL('..', import.meta.url).pathname,
        resolve: { tsconfigPaths: true },
        plugins: [tailwindcss(), viteReact()],
        server: { host: '127.0.0.1', port: 0 },
      }),
    ).pipe(Effect.tap((vite) => Effect.promise(() => vite.listen()))),
  );
});

test.afterAll(async () => {
  await Effect.runPromise(Effect.promise(() => server.close()));
});

for (const mode of ['compact', 'full']) {
  test(`${mode} garment ratings support touch, keyboard, and accessible help`, async ({
    page,
  }, testInfo) => {
    const base = fixtureUrl();
    expect(base).toBeDefined();
    await page.goto(`${base}a11y/fixtures/garment-form.html?${mode}`);
    const warmth = page.getByRole('group', { name: 'Warmth', exact: true });
    const formality = page.getByRole('group', {
      name: 'Formality',
      exact: true,
    });
    await expect(warmth.getByRole('radio')).toHaveCount(warmthLabels.length);
    await expect(formality.getByRole('radio')).toHaveCount(
      formalityLabels.length,
    );
    await expect(warmth.locator('label span:visible')).toHaveText(warmthLabels);
    await expect(formality.locator('label span:visible')).toHaveText(
      formalityLabels,
    );
    await expect(warmth.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await warmth.getByText('Light', { exact: true }).click();
    const light = warmth.getByRole('radio', { name: 'Light' });
    await expect(light).toBeChecked();
    await expect(light).toHaveAccessibleDescription(lightHelp);
    await expect(warmth.getByText(lightHelp)).toBeVisible();
    await light.focus();
    await page.keyboard.press('ArrowRight');
    const medium = warmth.getByRole('radio', { name: 'Medium' });
    await expect(medium).toBeFocused();
    await expect(medium).toBeChecked();
    await expect(medium).toHaveAccessibleDescription(mediumHelp);
    await expect(
      warmth
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: 'Medium' }) }),
    ).toHaveCSS('outline-style', 'solid');
    await formality.getByText('Formal', { exact: true }).click();
    await expect(
      formality.getByRole('radio', { name: 'Formal' }),
    ).toBeChecked();
    await expect(formality.getByText(formalHelp)).toBeVisible();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('garment-ratings.png'),
      fullPage: true,
    });
  });
}
