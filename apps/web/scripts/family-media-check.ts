// biome-ignore lint/correctness/noUnresolvedImports: Biome cannot resolve Playwright's re-exports; TypeScript and the browser run verify these exports.
import { type APIRequestContext, expect } from '@playwright/test';
import {
  mediaUrl,
  smallWidth,
  variantKey,
} from '../src/shared/media/media-variants.ts';

const ok = 200;
const notFound = 404;
const unlistedWidth = 500;

type MediaCopyCheck = {
  readonly origin: string;
  readonly mediaDirectory: string;
  readonly photoKey: string;
  readonly owner: APIRequestContext;
  readonly stranger: APIRequestContext;
};

/**
 * Smaller copies pass the same ownership check as the original and are kept
 * beside it. A served picture may be cached privately; a refusal may not.
 */
export const checkMediaCopies = async ({
  origin,
  mediaDirectory,
  photoKey,
  owner,
  stranger,
}: MediaCopyCheck) => {
  const copyUrl = `${origin}${mediaUrl(photoKey, smallWidth)}`;
  expect((await stranger.get(copyUrl)).status()).toBe(notFound);
  const copy = await owner.get(copyUrl);
  expect(copy.status()).toBe(ok);
  expect(copy.headers()['content-type']).toBe('image/webp');
  expect(copy.headers()['cache-control']).toBe(
    'private, max-age=31536000, immutable',
  );
  expect(
    await Bun.file(
      `${mediaDirectory}/${variantKey(photoKey, smallWidth)}`,
    ).exists(),
  ).toBe(true);
  const unlisted = await owner.get(
    `${origin}/api/media/${photoKey}?w=${unlistedWidth}`,
  );
  expect(unlisted.status()).toBe(notFound);
  expect(unlisted.headers()['cache-control']).toContain('no-store');
};
