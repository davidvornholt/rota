import type * as playwright from '@playwright/test';

/** A tab in the app shell's main navigation. */
export const mainTab = (page: playwright.Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name, exact: true });

/** The Today or Tomorrow link of the planning page's day switcher. */
export const dayLink = (page: playwright.Page, name: 'Today' | 'Tomorrow') =>
  page
    .getByRole('navigation', { name: 'Outfit day' })
    .getByRole('link', { name, exact: true });
