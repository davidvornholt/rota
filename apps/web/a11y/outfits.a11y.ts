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

test('outfits go into collections and the filter shows those in every chosen one', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  await expect(page.getByRole('group', { name: 'Filter outfits' })).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: 'Edit Blue and navy' }).click();
  let dialog = page.getByRole('dialog', { name: 'Edit Blue and navy' });
  const newCollection = dialog.getByRole('textbox', { name: 'New collection' });
  await newCollection.fill('Work');
  await newCollection.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Work', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // A name typed but not added still goes with the outfit.
  await newCollection.fill('Summer');
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Summer · Work', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Create outfit' }).click();
  dialog = page.getByRole('dialog', { name: 'Create outfit' });
  await dialog.getByRole('textbox', { name: 'Outfit name' }).fill('Weekend');
  await dialog.getByRole('button', { name: 'Summer', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'New collection' }).fill('weekend');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
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
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);

  const filter = page.getByRole('group', { name: 'Filter outfits' });
  const work = filter.getByRole('button', { name: 'Work, 1 outfit' });
  await work.click();
  await expect(work).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText('1 of 2 saved outfits', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekend' })).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  await filter.getByRole('button', { name: 'weekend, 1 outfit' }).click();
  const empty = page.getByText('No saved outfit is in Work and weekend.');
  await expect(empty).toBeVisible();
  await empty.getByRole('button', { name: 'Show all' }).click();
  await expect(
    page.getByText('2 saved outfits', { exact: true }),
  ).toBeVisible();

  const summer = filter.getByRole('button', { name: 'Summer, 2 outfits' });
  await summer.click();
  await page.reload();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
});

test('favourites are marked with a heart and filtered alone or with collections', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  const filter = page.getByRole('group', { name: 'Filter outfits' });
  await expect(filter).toHaveCount(0);
  const blue = page.getByRole('button', {
    name: 'Favourite Blue and navy',
    exact: true,
  });
  await expect(blue).toHaveAttribute('aria-pressed', 'false');
  await blue.click();
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await expect(blue).toBeFocused();
  await expect(
    page.getByText('Added Blue and navy to favourites.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit collections' }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  // A new outfit starts as a favourite under the favourites filter.
  await filter.getByRole('button', { name: 'Favourites, 1 outfit' }).click();
  await page.getByRole('button', { name: 'Create outfit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create outfit' });
  await dialog.getByRole('textbox', { name: 'Outfit name' }).fill('Weekend');
  await dialog.getByRole('textbox', { name: 'New collection' }).fill('Weekend');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
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
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const weekend = page.getByRole('button', {
    name: 'Favourite Weekend',
    exact: true,
  });
  await expect(weekend).toHaveAttribute('aria-pressed', 'true');

  await filter.getByRole('button', { name: 'Weekend, 1 outfit' }).click();
  await page.reload();
  await expect(
    filter.getByRole('button', { name: 'Favourites, 2 outfits' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText('1 of 2 saved outfits', { exact: true }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  // Unmarking an outfit under the filter removes the card that held focus.
  await weekend.click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Outfits' }),
  ).toBeFocused();
  await expect(
    page.getByText('Removed Weekend from favourites.', { exact: true }),
  ).toBeVisible();
  const empty = page.getByText('No favourite is in Weekend.');
  await expect(empty).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await empty.getByRole('button', { name: 'Show all' }).click();
  await expect(
    page.getByText('2 saved outfits', { exact: true }),
  ).toBeVisible();

  // Without favourites left, the filter lets go of them, and marking one
  // later does not narrow the list.
  await filter.getByRole('button', { name: 'Favourites, 1 outfit' }).click();
  await blue.click();
  await expect(blue).toHaveAttribute('aria-pressed', 'false');
  await expect(blue).toBeFocused();
  await expect(
    filter.getByRole('button', { name: 'Favourites', exact: false }),
  ).toHaveCount(0);
  await blue.click();
  await expect(
    filter.getByRole('button', { name: 'Favourites, 1 outfit' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByText('2 saved outfits', { exact: true }),
  ).toBeVisible();
});

test('collections are renamed, merged and deleted while their outfits stay', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  await page.getByRole('button', { name: 'Edit Blue and navy' }).click();
  const outfitDialog = page.getByRole('dialog', { name: 'Edit Blue and navy' });
  const newCollection = outfitDialog.getByRole('textbox', {
    name: 'New collection',
  });
  for (const name of ['Work', 'Summer']) {
    await newCollection.fill(name);
    await newCollection.press('Enter');
  }
  await outfitDialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  const filter = page.getByRole('group', { name: 'Filter outfits' });
  await filter.getByRole('button', { name: 'Summer, 1 outfit' }).click();

  await page.getByRole('button', { name: 'Edit collections' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit collections' });
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  const rename = dialog.getByRole('textbox', { name: 'Name of Summer' });
  await rename.fill('work');
  await rename.press('Enter');
  const status = dialog.getByRole('status');
  await expect(status).toHaveText('Renamed Summer to Work.');
  await expect(status).toBeFocused();
  await expect(dialog.getByRole('textbox')).toHaveCount(1);
  await expect(
    filter.getByRole('button', { name: 'Work, 1 outfit' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: 'Delete Work' }).click();
  await dialog.getByRole('button', { name: 'Remove from 1 outfit' }).click();
  await expect(status).toHaveText('Deleted Work. Its outfits stay.');
  await expect(dialog.getByText('No collections left.')).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(filter).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Outfits' }),
  ).toBeFocused();
  await expect(page.getByText('1 saved outfit', { exact: true })).toBeVisible();
});

test('focus stays on the page when a collection action removes or disables the focused control', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  const heading = page.getByRole('heading', { level: 1, name: 'Outfits' });

  // Adding with the Add button empties the name, which disables the button.
  await page.getByRole('button', { name: 'Edit Blue and navy' }).click();
  let dialog = page.getByRole('dialog', { name: 'Edit Blue and navy' });
  let newCollection = dialog.getByRole('textbox', { name: 'New collection' });
  await newCollection.fill('Work');
  await newCollection.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Add', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    dialog.getByRole('button', { name: 'Work', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Soft, so one run reports every place where focus falls back to the page.
  await expect.soft(newCollection).toBeFocused();
  await newCollection.fill('Summer');
  await newCollection.press('Enter');
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);

  // A second outfit keeps Work in the filter after Blue and navy leaves it.
  const filter = page.getByRole('group', { name: 'Filter outfits' });
  await filter.getByRole('button', { name: 'Work, 1 outfit' }).click();
  await page.getByRole('button', { name: 'Create outfit' }).click();
  dialog = page.getByRole('dialog', { name: 'Create outfit' });
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
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);

  // Saved out of Work, the card whose button opened the dialog is gone.
  await page.getByRole('button', { name: 'Edit Blue and navy' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit Blue and navy' });
  await dialog.getByRole('button', { name: 'Work', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('1 of 2 saved outfits', { exact: true }),
  ).toBeVisible();
  await expect.soft(heading).toBeFocused();

  // Show all removes itself, both beside the filter and when nothing matches.
  await page.getByRole('button', { name: 'Show all' }).press('Enter');
  await expect(
    page.getByText('2 saved outfits', { exact: true }),
  ).toBeVisible();
  await expect.soft(heading).toBeFocused();
  await filter.getByRole('button', { name: 'Work, 1 outfit' }).click();
  await filter.getByRole('button', { name: 'Summer, 1 outfit' }).click();
  const empty = page.getByText('No saved outfit is in Work and Summer.');
  await empty.getByRole('button', { name: 'Show all' }).press('Enter');
  await expect(empty).toHaveCount(0);
  await expect.soft(heading).toBeFocused();

  // The twelfth collection, the most an outfit can be in, disables the field.
  await page.getByRole('button', { name: 'Create outfit' }).click();
  dialog = page.getByRole('dialog', { name: 'Create outfit' });
  newCollection = dialog.getByRole('textbox', { name: 'New collection' });
  for (let trip = 1; trip <= 12; trip += 1) {
    await newCollection.fill(`Trip ${trip}`);
    await newCollection.press('Enter');
  }
  await expect(newCollection).toBeDisabled();
  await expect
    .soft(dialog.getByRole('button', { name: 'Trip 12', exact: true }))
    .toBeFocused();
});
