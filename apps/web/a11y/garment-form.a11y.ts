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
        resolve: {
          tsconfigPaths: true,
          alias: {
            './garments-fns.ts': new URL(
              './fixtures/garments-fns.ts',
              import.meta.url,
            ).pathname,
            '../services/garments-fns.ts': new URL(
              './fixtures/garments-fns.ts',
              import.meta.url,
            ).pathname,
          },
        },
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
    const colours = page.getByRole('group', { name: 'Colours', exact: true });
    await expect(
      colours.getByRole('button', { name: 'Remove colour 1' }),
    ).toBeDisabled();
    const picker = colours.getByLabel('Colour 1', { exact: true });
    const label = colours.getByRole('status', { name: 'Colour 1 name' });
    await expect(label).toHaveText('Blue');
    await picker.fill('#ff0000');
    await expect(label).toHaveText('Red');
    await expect(
      colours.getByRole('textbox', { name: 'Colour 1 name' }),
    ).toHaveCount(0);
    await colours.getByRole('button', { name: 'Add a colour' }).click();
    await expect(
      colours.getByRole('status', { name: 'Colour 2 name' }),
    ).toHaveText('Grey');
    await expect(
      colours.getByRole('button', { name: 'Remove colour 1' }),
    ).toBeEnabled();
    await colours.getByRole('button', { name: 'Remove colour 1' }).click();
    await expect(
      colours.getByRole('button', { name: 'Remove colour 1' }),
    ).toBeDisabled();
    await expect(colours.getByLabel('Colour 1', { exact: true })).toHaveCount(
      1,
    );
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

test('colour groups wrap and keep the remaining values when one is removed', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl()}a11y/fixtures/garment-form.html?full`);
  const colours = page.getByRole('group', { name: 'Colours', exact: true });
  await Effect.runPromise(
    Effect.forEach(['#ff0000', '#112233', '#f5f0e6', '#808000'], (hex) =>
      Effect.promise(async () => {
        await colours.getByRole('button', { name: 'Add a colour' }).click();
        await colours.getByRole('textbox').last().fill(hex);
      }),
    ),
  );
  await expect(
    colours.getByRole('button', { name: 'Add a colour' }),
  ).toHaveCount(0);
  await expect(colours.getByRole('status')).toHaveText([
    'Blue',
    'Red',
    'Navy',
    'Off-white',
    'Olive',
  ]);
  await colours.getByRole('button', { name: 'Remove colour 2' }).click();
  await expect(colours.getByRole('status')).toHaveText([
    'Blue',
    'Navy',
    'Off-white',
    'Olive',
  ]);
  await expect(
    colours.getByRole('button', { name: 'Add a colour' }),
  ).toBeVisible();
  const rain = page.getByRole('checkbox', { name: 'Fine in rain' });
  await rain.uncheck();
  await expect(rain).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

for (const imageChoice of ['automatic', 'original']) {
  test(`render completion preserves edits and ${imageChoice} picture selection`, async ({
    page,
  }) => {
    await page.goto(`${fixtureUrl()}a11y/fixtures/review-card.html`);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('My corrected shirt');
    const warmth = page.getByRole('group', { name: 'Warmth', exact: true });
    await warmth.getByText('Heavy', { exact: true }).click();
    if (imageChoice === 'original') {
      await page.getByRole('radio', { name: 'Photo', exact: true }).click();
    }
    await page
      .getByRole('button', { name: 'Finish render', exact: true })
      .click();
    await expect(
      page.getByRole('radio', { name: 'Studio', exact: true }),
    ).toBeEnabled();
    await expect(name).toHaveValue('My corrected shirt');
    await expect(
      warmth.getByRole('radio', { name: 'Heavy', exact: true }),
    ).toBeChecked();
    const selected = imageChoice === 'original' ? 'Photo' : 'Studio';
    await expect(
      page.getByRole('radio', { name: selected, exact: true }),
    ).toBeChecked();
    await page
      .getByRole('button', { name: 'Add to wardrobe', exact: true })
      .click();
    await expect(page.getByLabel('Accepted garment')).toContainText(
      'My corrected shirt',
    );
    await expect(page.getByLabel('Accepted garment')).toContainText(
      `"imageChoice":"${imageChoice === 'original' ? 'original' : 'studio'}"`,
    );
  });
}

for (const mode of ['review', 'detail']) {
  test(`${mode} rerender uses current colours and instructions and recovers from failure`, async ({
    page,
  }) => {
    await page.goto(`${fixtureUrl()}a11y/fixtures/review-card.html?${mode}`);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('My corrected shirt');
    await page.getByRole('button', { name: 'Rate limit', exact: true }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Image service is busy. Retrying shortly.' }),
    ).toBeVisible();
    await expect(name).toHaveValue('My corrected shirt');
    await page
      .getByRole('button', { name: 'Finish render', exact: true })
      .click();
    const render = page.getByRole('button', {
      name: 'Regenerate studio image',
      exact: true,
    });
    const colourName = page.getByRole('status', {
      name: 'Colour 1 name',
      exact: true,
    });
    await expect(render).toBeEnabled();
    await page.getByLabel('Colour 1', { exact: true }).fill('#112233');
    await page
      .getByRole('textbox', { name: 'Image instructions, optional' })
      .fill('Keep the white buttons.');
    await render.click();
    await expect(page.getByLabel('Render request')).toContainText(
      '"hex":"#112233"',
    );
    await expect(colourName).toHaveText('Navy');
    await expect(page.getByLabel('Render request')).toContainText(
      'Keep the white buttons.',
    );
    await expect(render).toBeDisabled();
    await expect(page.getByLabel('Colour 1', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Rate limit', exact: true }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Image service is busy. Retrying shortly.' }),
    ).toBeVisible();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
    await page
      .getByRole('button', { name: 'Fail render', exact: true })
      .click();
    await expect(
      page.getByText('The studio render failed', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(render).toBeEnabled();
    await expect(colourName).toHaveText('Navy');
    await render.click();
    await expect(render).toBeDisabled();
    await page
      .getByRole('button', { name: 'Finish render', exact: true })
      .click();
    await expect(
      page.getByText('Studio picture updated.', { exact: true }),
    ).toBeVisible();
    await expect(render).toBeEnabled();
    await expect(colourName).toHaveText('Navy');
    expect(await scanWcag22AaViolations(page)).toEqual([]);
    await expect(name).toHaveValue('My corrected shirt');
  });
}
