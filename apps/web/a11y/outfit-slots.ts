import type * as playwright from '@playwright/test';

type EmptySlot = 'top' | 'bottom';

/**
 * An outfit slot with nothing picked yet. Its name is the two lines it shows:
 * the prompt and the "Add" caption.
 */
export const emptySlot = (
  scope: playwright.Locator | playwright.Page,
  slot: EmptySlot,
) =>
  scope.getByRole('button', {
    name: `Choose a piece Add ${slot}`,
    exact: true,
  });
