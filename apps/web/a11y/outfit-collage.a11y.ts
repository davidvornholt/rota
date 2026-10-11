import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const collagePage = `${fixtureOrigin}a11y/fixtures/outfit-collage.html`;
const weekend = 'Weekend: Sand chinos, Blue Oxford shirt, Green knit jumper';
/** The fixture answers a new attempt as queued and the next poll, three seconds later, as ready. */
const pollTimeout = 10_000;

type SharedFile = {
  readonly name: string;
  readonly type: string;
  readonly title: string;
};

test('collages name the outfit and only the pieces they show', async ({
  page,
}) => {
  await page.goto(collagePage);
  await expect(
    page.getByRole('img', { name: weekend, exact: true }),
  ).toHaveAttribute('src', '/a11y/fixtures/collage.png');
  await expect(
    page.getByRole('img', { name: 'Pared back: Sand chinos', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Office: Sand chinos, White Oxford shirt',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({
      hasText: 'Making the picture. This takes about a minute.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Share Unpictured as picture' }),
  ).toBeDisabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('a failed picture can be made again', async ({ page }) => {
  await page.goto(collagePage);
  const rainy = page.getByRole('listitem').filter({ hasText: 'Rainy day' });
  await expect(
    rainy.getByRole('status').filter({
      hasText: 'Rota could not make this picture.',
    }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await rainy.getByRole('button', { name: 'Try again' }).click();
  await expect(
    rainy.getByRole('status').filter({
      hasText: 'Waiting for another picture to finish.',
    }),
  ).toBeVisible();
  await expect(
    rainy.getByRole('img', {
      name: 'Rainy day: Sand chinos, Blue Oxford shirt, Forest knit jumper',
      exact: true,
    }),
  ).toHaveAttribute('src', '/a11y/fixtures/collage.png', {
    timeout: pollTimeout,
  });
});

test('a picture still being made offers nothing to share yet', async ({
  page,
}) => {
  await page.goto(collagePage);
  await page.getByRole('button', { name: 'Share Office as picture' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Making the picture.' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Download picture' }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('where the browser cannot share files, the outfit downloads as a 4:5 picture', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(navigator, { canShare: undefined });
  });
  await page.goto(collagePage);
  const open = page.getByRole('button', { name: 'Share Weekend as picture' });
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Weekend' })).toBeFocused();
  await expect(
    dialog.getByRole('img', { name: weekend, exact: true }),
  ).toBeVisible();
  const downloadLink = dialog.getByRole('link', { name: 'Download picture' });
  await expect(downloadLink).toHaveAttribute('download', 'weekend.png');
  await expect(
    dialog.getByRole('button', { name: 'Share picture' }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLink.click(),
  ]);
  expect(download.suggestedFilename()).toBe('weekend.png');
  const href = await downloadLink.getAttribute('href');
  expect(
    await page.evaluate(async (url) => {
      const bitmap = await createImageBitmap(
        await (await fetch(url ?? '')).blob(),
      );
      return { width: bitmap.width, height: bitmap.height };
    }, href),
  ).toEqual({ width: 1088, height: 1360 });

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('where the browser can share files, the picture goes to the share sheet', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const shared: Array<SharedFile> = [];
    Object.assign(globalThis, { shared });
    Object.assign(navigator, {
      canShare: (data: ShareData) => (data.files?.length ?? 0) > 0,
      share: (data: ShareData) => {
        for (const file of data.files ?? []) {
          shared.push({
            name: file.name,
            type: file.type,
            title: data.title ?? '',
          });
        }
        return Promise.resolve();
      },
    });
  });
  await page.goto(collagePage);
  await page.getByRole('button', { name: 'Share Weekend as picture' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Share picture' }).click();
  expect(
    await page.evaluate(
      () => (globalThis as unknown as { shared: unknown }).shared,
    ),
  ).toEqual([{ name: 'weekend.png', type: 'image/png', title: 'Weekend' }]);
  await expect(
    dialog.getByRole('link', { name: 'Download picture' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
