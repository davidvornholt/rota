import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
// biome-ignore lint/correctness/noUnresolvedImports: TypeScript and browser execution verify Playwright's re-exports.
import { expect, type Page } from '@playwright/test';

export const checkCodeActions = async (page: Page) => {
  await expect(
    page.getByRole('heading', {
      name: 'Invitation for Alex (demo)',
      exact: true,
    }),
  ).toBeFocused();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Code copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await page
      .getByRole('textbox', { name: 'Access code', exact: true })
      .inputValue(),
  );
  const directory = Bun.env.FAMILY_SCREENSHOT_DIR;
  if (directory) {
    await page.screenshot({
      path: `${directory}/family-code-actions.png`,
      fullPage: true,
      maskColor: '#667085',
      mask: [page.getByRole('textbox', { name: 'Access code', exact: true })],
    });
  }
};

export const checkPeopleActions = async (
  page: Page,
  capture: (page: Page, name: string) => Promise<void>,
) => {
  const alex = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Alex (demo)', exact: true }),
  });
  await expect(
    alex.getByRole('button', { name: 'Suspend access', exact: true }),
  ).toBeHidden();
  await capture(page, 'family-admin-people');
  const manage = alex.locator('summary');
  await manage.focus();
  await page.keyboard.press('Enter');
  await expect(
    alex.getByRole('button', { name: 'Issue recovery code' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await capture(page, 'family-admin-access-expanded');
  await alex
    .getByRole('button', { name: 'Suspend access', exact: true })
    .click();
  await expect(
    alex.getByRole('button', { name: 'Restore access', exact: true }),
  ).toBeVisible();
  await expect(
    alex.getByRole('button', { name: 'Issue recovery code' }),
  ).toBeHidden();
  await alex
    .getByRole('button', { name: 'Restore access', exact: true })
    .click();
  await expect(
    alex.getByRole('button', { name: 'Issue recovery code' }),
  ).toBeVisible();
  await manage.click();
  await page.getByText('API prices', { exact: true }).click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await capture(page, 'family-admin-people-mobile');
  await manage.click();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await capture(page, 'family-admin-access-expanded-mobile');
  await alex.getByRole('button', { name: 'Issue recovery code' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Recovery code for Alex (demo)',
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Hide code', exact: true }).click();
};
