import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const collagePage = `${fixtureOrigin}a11y/fixtures/outfit-collage.html`;
const layeredInDialog = /^Layered: Navy pinstripe trousers/u;

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
    page.getByRole('img', {
      name: 'Layered: Navy pinstripe trousers, White tee, Grey cardigan, Black loafers, Tan bag',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Fallbacks: Olive chinos, Blue Oxford shirt, Grey cardigan',
      exact: true,
    }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('where the browser cannot share files, the outfit downloads as a 4:5 picture', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(navigator, { canShare: undefined });
  });
  await page.goto(collagePage);
  const open = page.getByRole('button', { name: 'Share Layered as picture' });
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Layered' })).toBeFocused();
  await expect(
    dialog.getByRole('img', { name: layeredInDialog }),
  ).toBeVisible();
  const downloadLink = dialog.getByRole('link', { name: 'Download picture' });
  await expect(downloadLink).toHaveAttribute('download', 'layered.png');
  await expect(
    dialog.getByRole('button', { name: 'Share picture' }),
  ).toHaveCount(0);
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLink.click(),
  ]);
  expect(download.suggestedFilename()).toBe('layered.png');
  const href = await downloadLink.getAttribute('href');
  expect(
    await page.evaluate(async (url) => {
      const picture = await createImageBitmap(
        await (await fetch(url ?? '')).blob(),
      );
      return { width: picture.width, height: picture.height };
    }, href),
  ).toEqual({ width: 1080, height: 1350 });

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
  await page
    .getByRole('button', { name: 'Share Single layer as picture' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Share picture' }).click();
  expect(
    await page.evaluate(
      () => (globalThis as unknown as { shared: unknown }).shared,
    ),
  ).toEqual([
    { name: 'single-layer.png', type: 'image/png', title: 'Single layer' },
  ]);
  await expect(
    dialog.getByRole('link', { name: 'Download picture' }),
  ).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
