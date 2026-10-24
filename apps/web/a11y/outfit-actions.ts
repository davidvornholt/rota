import type * as playwright from '@playwright/test';

type OutfitAction = 'Edit' | 'Share as picture' | 'Delete';

/** Picks one of an outfit card's actions from its More actions menu. */
export const chooseOutfitAction = async (
  page: playwright.Page,
  outfit: string,
  action: OutfitAction,
) => {
  await page
    .getByRole('button', { name: `More actions for ${outfit}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
};
