import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const shirtWorn = /Blue Oxford shirt1 of 2 wears · last worn 5 Sept/u;
const chinosWorn = /Navy chinos2 of 4 wears · last worn 7 Sept/u;

test('laundry lists pieces worn since washing, closest to the wash first, and sends one to the basket or counts it washed', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?worn`);
  await page.getByRole('link', { name: 'Laundry', exact: true }).click();
  const laundry = page.getByRole('main');
  const worn = laundry.getByRole('region', { name: 'Worn since washing' });
  await expect(worn.getByRole('listitem')).toHaveText([shirtWorn, chinosWorn]);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await worn
    .getByRole('button', { name: 'Put in basket: Navy chinos', exact: true })
    .click();
  await expect(worn.getByRole('listitem')).toHaveCount(1);
  await expect(
    laundry
      .getByRole('region', { name: 'In laundry' })
      .getByRole('button', { name: 'Back clean: Navy chinos', exact: true }),
  ).toBeVisible();
  await worn
    .getByRole('button', { name: 'Washed: Blue Oxford shirt', exact: true })
    .click();
  await expect(worn).toHaveCount(0);
  await expect(laundry.getByRole('status')).toHaveText('Laundry updated.');
});
