import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';
import { fixtureOrigin } from './fixture-origin.ts';

const wardrobe = `${fixtureOrigin}a11y/fixtures/wardrobe.html`;
const uploads = '**/api/garments/upload';
const tooLarge = 413;
const linkMessage =
  'That is a link to a picture, not the picture itself. Copy the image, then paste it here.';
const waitingCount = /· 1 waiting/u;
const pasteShortcut = /^(?<modifier>Control|Meta)\+V$/u;

type Answer = { readonly status: number; readonly body: string };

/** Answers each upload in turn; `null` drops the connection instead. */
const answerUploads = async (
  page: playwright.Page,
  answers: Array<Answer | null>,
): Promise<void> => {
  let next = 0;
  await page.route(uploads, async (route) => {
    expect(route.request().method()).toBe('POST');
    const answer = answers[next];
    next += 1;
    if (answer === null || answer === undefined) {
      await route.abort('internetdisconnected');
      return;
    }
    await route.fulfill({
      status: answer.status,
      body: answer.body,
      contentType:
        answer.status < 300 ? 'application/json' : 'text/plain; charset=utf-8',
    });
  });
};

const accepted = (id: string): Answer => ({
  status: 202,
  body: JSON.stringify({ ids: [id] }),
});

/** Puts the one-pixel fixture PNG on the system clipboard. */
const copyPicture = (page: playwright.Page) =>
  page.evaluate(async () => {
    const response = await fetch('/a11y/fixtures/pixel.png');
    const picture = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': picture }),
    ]);
  });

/** Sends a drag of the given files over the page, as a file manager would. */
const drag = (
  page: playwright.Page,
  type: 'dragenter' | 'drop',
  mime: string,
) =>
  page.evaluate(
    async (sent) => {
      const response = await fetch('/a11y/fixtures/pixel.png');
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([await response.blob()], 'garment', { type: sent.mime }),
      );
      document.body.dispatchEvent(
        new DragEvent(sent.type, {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { type, mime },
  );

const pasteText = (page: playwright.Page, text: string) =>
  page.evaluate((pasted) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', pasted);
    document.body.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('a picture pasted with the keyboard joins the queue at once', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(uploads, async (route) => {
    await held;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ids: ['pasted-1'] }),
    });
  });
  await page.goto(wardrobe);
  await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible();
  await copyPicture(page);
  await page.keyboard.press('ControlOrMeta+V');

  const queue = page.getByRole('region', { name: 'Waiting to join' });
  await expect(queue.getByRole('listitem')).toHaveCount(1);
  await expect(queue.getByRole('status')).toHaveText('Sending the photo …');
  await expect(page.getByText(waitingCount)).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  release();
  await expect(queue.getByRole('status')).toHaveText('Looking at the photo …');
  await expect(queue.getByRole('listitem')).toHaveCount(1);
});

test('the paste button reads the clipboard and names its shortcut', async ({
  page,
}) => {
  await answerUploads(page, [accepted('pasted-2')]);
  await page.goto(wardrobe);
  const paste = page.getByRole('button', { name: 'Paste', exact: true });
  await expect(paste).toHaveAttribute('aria-keyshortcuts', pasteShortcut);

  await page.evaluate(() => navigator.clipboard.writeText('Navy wool coat'));
  await paste.click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'no picture in it' }),
  ).toBeVisible();

  await copyPicture(page);
  await paste.click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Waiting to join' }).getByRole('status'),
  ).toHaveText('Looking at the photo …');
});

test('a photo that did not go through can be sent again or removed', async ({
  page,
}) => {
  await answerUploads(page, [
    null,
    accepted('retried-1'),
    { status: tooLarge, body: 'That photo is too large.' },
  ]);
  await page.goto(wardrobe);
  const queue = page.getByRole('region', { name: 'Waiting to join' });
  const choose = page.getByLabel('Choose photos');

  await choose.setInputFiles('a11y/fixtures/pixel.png');
  await expect(queue.getByRole('alert')).toHaveText(
    'The photo could not be sent. Check the connection and try again.',
  );
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await queue.getByRole('button', { name: 'Try again' }).click();
  await expect(queue.getByRole('status')).toBeFocused();
  await expect(queue.getByRole('status')).toHaveText('Looking at the photo …');

  await choose.setInputFiles('a11y/fixtures/pixel.png');
  const refused = queue
    .getByRole('listitem')
    .filter({ hasText: 'That photo is too large.' });
  await expect(refused).toBeVisible();
  // Sending a refused photo again would be refused again.
  await expect(refused.getByRole('button', { name: 'Try again' })).toHaveCount(
    0,
  );
  await refused.getByRole('button', { name: 'Remove' }).click();
  await expect(refused).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Waiting to join' }),
  ).toBeFocused();
  await expect(queue.getByRole('listitem')).toHaveCount(1);
});

test('pictures dragged over the page can be dropped anywhere', async ({
  page,
}) => {
  await answerUploads(page, [accepted('dropped-1')]);
  await page.goto(wardrobe);
  const overlay = page.getByText('Drop to add');

  await drag(page, 'dragenter', 'image/png');
  await expect(overlay).toBeVisible();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await drag(page, 'drop', 'image/png');
  await expect(overlay).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Waiting to join' }).getByRole('status'),
  ).toHaveText('Looking at the photo …');

  await drag(page, 'dragenter', 'application/pdf');
  await drag(page, 'drop', 'application/pdf');
  await expect(page.getByRole('alert')).toHaveText(
    'Only pictures can be added to the wardrobe. Paste or drop a photo of the garment.',
  );
});

test('a pasted link explains itself, and text fields keep their text', async ({
  page,
}) => {
  await page.goto(`${wardrobe}?empty&field`);
  await expect(page.getByText('or paste or drop a picture')).toBeVisible();

  await pasteText(page, 'https://shop.example/oxford-shirt.jpg');
  const notice = page.getByRole('alert');
  await expect(notice).toHaveText(linkMessage);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeFocused();

  await page.evaluate(() =>
    navigator.clipboard.writeText('https://shop.example/oxford-shirt.jpg'),
  );
  const field = page.getByRole('textbox', { name: 'Fixture text field' });
  await field.focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(field).toHaveValue('https://shop.example/oxford-shirt.jpg');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Waiting to join' }),
  ).toHaveCount(0);
});
