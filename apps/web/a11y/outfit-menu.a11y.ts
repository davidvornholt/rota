import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';
import { chooseOutfitAction } from './outfit-actions.ts';

const openOutfits = async (page: playwright.Page) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?page=outfits`);
  const more = page.getByRole('button', {
    name: 'More actions for Blue and navy',
    exact: true,
  });
  const menu = page.getByRole('menu', {
    name: 'More actions for Blue and navy',
  });
  const action = (name: string) =>
    menu.getByRole('menuitem', { name, exact: true });
  return { more, menu, action };
};

test('the card menu opens, moves and closes from the keyboard', async ({
  page,
}) => {
  const { more, menu, action } = await openOutfits(page);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('ArrowDown');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(action('Edit')).toBeFocused();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('ArrowUp');
  await expect(action('Delete')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(action('Edit')).toBeFocused();
  await page.keyboard.press('End');
  await expect(action('Delete')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(action('Edit')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'false');

  // Up opens on the last action; Tab moves on past the menu and closes it.
  await page.keyboard.press('ArrowUp');
  await expect(action('Delete')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Choose for today' }),
  ).toBeFocused();

  // A dialog opened from the menu hands focus back to the menu's button.
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(action('Edit')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Blue and navy' });
  await expect(dialog.getByText('Share as picture')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
});

test('a press outside the card menu or on its button closes it', async ({
  page,
}) => {
  const { more, menu } = await openOutfits(page);
  await more.click();
  await expect(menu).toBeVisible();
  await page.getByRole('heading', { level: 1, name: 'Outfits' }).click();
  await expect(menu).toHaveCount(0);
  await more.click();
  await expect(menu).toBeVisible();
  await more.click();
  await expect(menu).toHaveCount(0);
});

test('delete from the card menu asks first, and Cancel returns to the menu button', async ({
  page,
}) => {
  const { more } = await openOutfits(page);
  await chooseOutfitAction(page, 'Blue and navy', 'Delete');
  const question = page.getByRole('group', {
    name: 'Delete this saved outfit?',
  });
  await expect(question).toBeFocused();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(
    question.getByRole('button', { name: 'Delete outfit' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(question).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'Blue and navy' }),
  ).toBeVisible();
});
