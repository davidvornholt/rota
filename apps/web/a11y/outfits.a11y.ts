import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const whiteShirt = /^White cotton shirt/u;
const chinos = /^Navy chinos/u;

test('the outfits page creates an outfit and chooses it for today', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Outfits' }),
  ).toBeVisible();
  await expect(page.getByText('1 saved outfit', { exact: true })).toBeVisible();
  // The fixture chinos have no picture, so the collage names only the shirt.
  await expect(
    page.getByRole('img', { name: 'Blue and navy: Blue Oxford shirt' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  const create = page.getByRole('button', { name: 'Create outfit' });
  await create.click();
  const dialog = page.getByRole('dialog', { name: 'Create outfit' });
  await dialog.getByRole('textbox', { name: 'Outfit name' }).fill('Weekend');
  await dialog.getByRole('button', { name: 'Choose top', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Choose top' })
    .getByRole('button', { name: whiteShirt })
    .click();
  await dialog
    .getByRole('button', { name: 'Choose bottom', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Choose bottom' })
    .getByRole('button', { name: chinos })
    .click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  await expect(page.getByText('Saved Weekend.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('2 saved outfits', { exact: true }),
  ).toBeVisible();

  const weekend = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Weekend' }) });
  const choose = weekend.getByRole('link', { name: 'Choose for today' });
  await expect(choose).toHaveAccessibleDescription('Weekend');
  await choose.click();
  await expect(
    page.getByRole('heading', { name: 'What will you wear?' }),
  ).toBeVisible();
  await expect(page.getByText('Based on Weekend')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
});

test('deleting the last outfit leaves an empty page with focus on its heading', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  await page
    .getByRole('button', { name: 'Delete Blue and navy', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete outfit', exact: true })
    .click();
  await expect(
    page.getByText('Save combinations you like, then wear them any day.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Outfits' }),
  ).toBeFocused();
  await expect(
    page.getByText('Deleted Blue and navy.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('0 saved outfits', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
