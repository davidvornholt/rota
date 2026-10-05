import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp from 'sharp';
import { largeWidth, smallWidth, tileWidth } from './media-variants.ts';
import { resizeImage } from './resize-image.ts';

const studioWidth = 1200;
const studioHeight = 1600;
const garmentWidth = 600;
const garmentHeight = 800;
const tileHeight = 853;
const narrowWidth = 300;
const narrowHeight = 400;
const rgba = 4;
const rgb = 3;
const opaque = 1;

const transparentRender = () =>
  sharp({
    create: {
      width: studioWidth,
      height: studioHeight,
      channels: rgba,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: garmentWidth,
            height: garmentHeight,
            channels: rgba,
            background: { r: 36, g: 54, b: 75, alpha: opaque },
          },
        },
        left: (studioWidth - garmentWidth) / 2,
        top: (studioHeight - garmentHeight) / 2,
      },
    ])
    .png()
    .toBuffer();

describe('image resizing', () => {
  it('scales to the width, keeps the aspect ratio and transparency, and encodes WebP', async () => {
    const source = new Uint8Array(await transparentRender());
    const resized = await Effect.runPromise(resizeImage(source, tileWidth));
    expect(await sharp(resized).metadata()).toMatchObject({
      format: 'webp',
      width: tileWidth,
      height: tileHeight,
      hasAlpha: true,
    });
    expect(resized.byteLength).toBeLessThan(source.byteLength);
  });

  it('keeps an image narrower than the width at its own size', async () => {
    const source = new Uint8Array(
      await sharp({
        create: {
          width: narrowWidth,
          height: narrowHeight,
          channels: rgb,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer(),
    );
    const resized = await Effect.runPromise(resizeImage(source, largeWidth));
    expect(await sharp(resized).metadata()).toMatchObject({
      format: 'webp',
      width: narrowWidth,
      height: narrowHeight,
    });
  });

  it('returns a typed failure for unreadable bytes', async () => {
    const result = await Effect.runPromise(
      resizeImage(new TextEncoder().encode('not an image'), smallWidth).pipe(
        Effect.result,
      ),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ImageResizeError' },
    });
  });
});
