import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

// A recent iPhone: in portrait the rounded corners and home indicator take the
// bottom 34 px; in landscape the notch takes 59 px on one side.
const portrait = { width: 390, height: 844 } as const;
const landscape = { width: 844, height: 390 } as const;
const bottomInset = 34;
const notchInset = 59;
const safeBottom = portrait.height - bottomInset;
const coversViewport = /viewport-fit=cover/u;
// The narrowest width WCAG reflow asks for, and a comfortable thumb target.
const narrowPhone = { width: 320, height: 640 } as const;
const minimumTarget = 44;
const tabNames = [
  'Today',
  'Wardrobe',
  'Outfits',
  'Laundry',
  'History',
  'Settings',
] as const;

const emulateRoundedPhone = async (
  page: playwright.Page,
  viewport: { readonly width: number; readonly height: number },
  insets: { readonly bottom?: number; readonly right?: number },
) => {
  await page.setViewportSize(viewport);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
};

const bottomOf = async (locator: playwright.Locator) => {
  const box = await locator.boundingBox();
  return (box?.y ?? Number.POSITIVE_INFINITY) + (box?.height ?? 0);
};

test('the page opts into safe-area insets', async ({ page }) => {
  await page.goto('/login');
  expect(
    await page.evaluate(
      () =>
        [...document.querySelectorAll('meta')].find(
          (meta) => meta.name === 'viewport',
        )?.content,
    ),
  ).toMatch(coversViewport);
});

test('bottom navigation stays clear of rounded corners and the home indicator', async ({
  page,
}) => {
  await emulateRoundedPhone(page, portrait, { bottom: bottomInset });
  await page.goto(`${fixtureOrigin}a11y/fixtures/people.html?shell`);
  const navigation = page.getByRole('navigation', { name: 'Main' });
  const tabBottoms = await Promise.all(
    tabNames.map((name) => bottomOf(navigation.getByRole('link', { name }))),
  );
  for (const bottom of tabBottoms) {
    expect(bottom).toBeLessThanOrEqual(safeBottom);
  }
  // The last of the page still scrolls clear of the taller navigation.
  const signOut = page
    .getByRole('contentinfo')
    .getByRole('button', { name: 'Sign out' });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const navigationTop = (await navigation.boundingBox())?.y;
  expect(await bottomOf(signOut)).toBeLessThanOrEqual(navigationTop ?? 0);
});

test('bottom navigation fits every destination on a 320 px phone', async ({
  page,
}) => {
  await page.setViewportSize(narrowPhone);
  await page.goto(`${fixtureOrigin}a11y/fixtures/people.html?shell`);
  const links = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link');
  await expect(links).toHaveText([...tabNames]);
  const boxes = await links.evaluateAll((elements) =>
    elements.map((element) => {
      // A label broken across lines does not overflow, so count its lines.
      const label = document.createRange();
      label.selectNodeContents(element.lastChild ?? element);
      const { left, right, height } = element.getBoundingClientRect();
      return {
        clipped: element.scrollWidth > element.clientWidth,
        lines: label.getClientRects().length,
        left,
        right,
        height,
      };
    }),
  );
  let previousRight = 0;
  for (const box of boxes) {
    expect(box.clipped).toBe(false);
    expect(box.lines).toBe(1);
    expect(box.left).toBeGreaterThanOrEqual(previousRight);
    expect(box.height).toBeGreaterThanOrEqual(minimumTarget);
    previousRight = box.right;
  }
  expect(previousRight).toBeLessThanOrEqual(narrowPhone.width);
});

test('a dialog sheet keeps its actions above the home indicator', async ({
  page,
}) => {
  await emulateRoundedPhone(page, portrait, { bottom: bottomInset });
  await page.goto(`${fixtureOrigin}a11y/fixtures/icon-actions.html`);
  await page.getByRole('button', { name: 'Edit occasion note' }).click();
  const save = page.getByRole('dialog').getByRole('button', {
    name: 'Save note',
  });
  await expect(save).toBeVisible();
  expect(await bottomOf(save)).toBeLessThanOrEqual(safeBottom);
});

test('an enlarged picture keeps its close button clear of the notch', async ({
  page,
}) => {
  await emulateRoundedPhone(page, landscape, { right: notchInset });
  await page.goto(
    `${fixtureOrigin}a11y/fixtures/review-card.html?detail&completed`,
  );
  await page
    .getByRole('button', { name: 'Show Blue Oxford shirt large' })
    .first()
    .click();
  const close = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  expect(
    (box?.x ?? Number.POSITIVE_INFINITY) + (box?.width ?? 0),
  ).toBeLessThanOrEqual(landscape.width - notchInset);
});
