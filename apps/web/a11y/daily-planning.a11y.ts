import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const whiteShirt = /^White cotton shirt/u;
const blueShirt = /^Blue Oxford shirt/u;
const greenDress = /^Green linen dress/u;
const badGateway = 502;
const success = 200;

test('navigation waits for early laundry, retains failures, and cannot restore a sent piece through autosave', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  let pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route('**/fixture-planning-action', async (route) => {
    await pending;
    await route.fulfill({
      status: fail ? badGateway : success,
      contentType: 'application/json',
      body: fail ? '' : '{}',
    });
  });
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?failure`);
  await page.getByRole('link', { name: 'Laundry', exact: true }).click();
  await page
    .getByText('Send a piece to laundry early', { exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Choose a piece', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: blueShirt })
    .click();
  const send = page.getByRole('button', { name: 'Put in basket' });
  const planning = page.getByRole('link', { name: 'Planning', exact: true });
  await send.click();
  await expect(send).toBeDisabled();
  await planning.click();
  release?.();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Laundry', exact: true }),
  ).toBeVisible();
  await expect(send).toBeEnabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  fail = false;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await send.click();
  await expect(send).toBeDisabled();
  await planning.click();
  release?.();
  const top = page.getByRole('button', { name: 'Choose top', exact: true });
  await expect(top).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Navy chinos' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(top).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
});

test('manual tomorrow choices save independently of reusable outfits and never record wear', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?tomorrow`);
  await expect(
    page.getByRole('link', { name: 'Today', exact: true }),
  ).toContainText('7 Sept');
  await expect(
    page.getByRole('link', { name: 'Tomorrow', exact: true }),
  ).toContainText('8 Sept');
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await expect(page.getByRole('button', { name: 'Wear this' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeVisible();
  await expect(page.getByText('Worn today', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Tomorrow', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Outfits', exact: true }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Blue and navy' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('incomplete and empty daily plans survive reload without resurrecting the previous suggestion', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Remove top', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change Navy chinos' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear this' })).toHaveCount(0);
  await expect(page.getByText('Worn today', { exact: true })).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('kept pieces constrain the next suggestion but keeping resets after reopening', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  const keep = page
    .getByRole('region', { name: 'Top', exact: true })
    .getByRole('checkbox', { name: 'Keep when suggesting' });
  await expect(keep).toBeChecked();
  await expect(
    page.getByText(
      'Checked pieces stay in your next suggestion. Keeping a piece does not record wear.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Suggest around kept pieces' })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.reload();
  await expect(keep).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Suggest another' }).click();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change Blue Oxford shirt' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear this' })).toBeVisible();
});

test('slow autosaves keep selection responsive and persist the latest edit in order', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/fixture-planning-action', async (route) => {
    const data = route.request().postDataJSON();
    if (data.change.action === 'plan') {
      requests += 1;
      if (requests === 1) {
        await pending;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?failure`);
  await page.getByRole('button', { name: 'Remove top', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText('Saving');
  await expect(
    page.getByRole('button', { name: 'Remove bottom', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Remove bottom', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Today', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  release?.();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  expect(requests).toBe(2);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Choose top', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose bottom', exact: true }),
  ).toBeVisible();
});

test('failed autosaves preserve edits, explain the failure, and persist after retry', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/fixture-planning-action', (route) =>
    route.fulfill({
      status: fail ? badGateway : success,
      contentType: 'application/json',
      body: fail ? '' : '{}',
    }),
  );
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html?tomorrow&failure`);
  await page.getByRole('button', { name: 'Change Blue Oxford shirt' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: whiteShirt })
    .click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Could not save',
  );
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry save', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const unsaved = page.getByRole('dialog', { name: 'Leave without saving?' });
  await expect(unsaved).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await unsaved.getByRole('button', { name: 'Stay here', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tomorrow starts here.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByLabel('Plan saving status')).toContainText(
    'Saved for',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Change White cotton shirt' }),
  ).toBeVisible();
});

test('a dress takes the place of the top and bottom and saves as a whole outfit', async ({
  page,
}) => {
  await page.goto(`${fixtureOrigin}a11y/fixtures/today.html`);
  await page.getByRole('button', { name: 'Wear a dress' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Choose dress' }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: greenDress }).click();
  await expect(
    page.getByRole('button', { name: 'Change Green linen dress' }),
  ).toBeFocused();
  for (const slot of ['Top', 'Bottom']) {
    await expect(
      page.getByRole('region', { name: slot, exact: true }),
    ).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Add top' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add bottom' })).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Save as a reusable outfit' }).click();
  await dialog
    .getByRole('textbox', { name: 'Outfit name' })
    .fill('Linen dress day');
  await dialog
    .getByRole('button', { name: 'Save outfit', exact: true })
    .click();
  await expect(
    page.getByText('Saved to your outfits.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove dress', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Choose bottom' }),
  ).toBeFocused();
  await expect(page.getByRole('button', { name: 'Choose top' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Wear a dress' }),
  ).toBeVisible();
});
