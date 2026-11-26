import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

test('a saved piece that left the wardrobe can be removed from the outfit', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?unavailable`);
  const under = page.getByRole('region', { name: 'Under layer', exact: true });
  await expect(under.getByText('Piece unavailable')).toBeVisible();
  await expect(
    page.getByText('A saved piece is no longer available.'),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await under
    .getByRole('button', { name: 'Remove under layer', exact: true })
    .click();
  await expect(under).toHaveCount(0);
  await expect(
    page.getByText('A saved piece is no longer available.'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeEnabled();
});
