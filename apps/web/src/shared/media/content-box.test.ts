import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp, { type OverlayOptions } from 'sharp';
import { measureContentBox } from './content-box.ts';

const renderWidth = 1200;
const renderHeight = 1600;
const rgba = 4;
const rgb = 3;
const opaque = 1;
/** The small copy is a quarter of the render, so edges land within a few pixels. */
const tolerance = 8;

const garment = { left: 240, top: 100, width: 720, height: 1400 };

const block = (
  width: number,
  height: number,
  colour: { r: number; g: number; b: number },
): OverlayOptions => ({
  input: {
    create: {
      width,
      height,
      channels: rgba,
      background: { ...colour, alpha: opaque },
    },
  },
});

const render = async ({
  ground,
  specks = false,
}: {
  readonly ground: 'transparent' | 'paper';
  readonly specks?: boolean;
}) =>
  new Uint8Array(
    await sharp({
      create: {
        width: renderWidth,
        height: renderHeight,
        channels: ground === 'transparent' ? rgba : rgb,
        background:
          ground === 'transparent'
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : { r: 250, g: 250, b: 251 },
      },
    })
      .composite([
        {
          ...block(garment.width, garment.height, { r: 36, g: 54, b: 75 }),
          left: garment.left,
          top: garment.top,
        },
        ...(specks
          ? [
              { ...block(3, 3, { r: 90, g: 40, b: 90 }), left: 60, top: 700 },
              { ...block(2, 2, { r: 20, g: 20, b: 20 }), left: 1150, top: 30 },
            ]
          : []),
      ])
      .png()
      .toBuffer(),
  );

/** How many pixels the furthest edge of a measured box is off the garment's. */
const offBy = (box: typeof garment) =>
  Math.max(
    Math.abs(box.left - garment.left),
    Math.abs(box.top - garment.top),
    Math.abs(box.width - garment.width),
    Math.abs(box.height - garment.height),
  );

describe('measuring the garment in a studio render', () => {
  it('finds the garment by transparency and ignores specks in the margin', async () => {
    const box = await Effect.runPromise(
      measureContentBox(await render({ ground: 'transparent', specks: true })),
    );
    expect(offBy(box)).toBeLessThanOrEqual(tolerance);
  });

  it('finds the garment on the flat paper ground of an opaque render', async () => {
    const box = await Effect.runPromise(
      measureContentBox(await render({ ground: 'paper' })),
    );
    expect(offBy(box)).toBeLessThanOrEqual(tolerance);
  });

  it('fails with a typed error when the render shows nothing', async () => {
    const empty = new Uint8Array(
      await sharp({
        create: {
          width: renderWidth,
          height: renderHeight,
          channels: rgba,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer(),
    );
    const result = await Effect.runPromise(
      measureContentBox(empty).pipe(Effect.result),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ImageMeasureError' },
    });
  });

  it('fails with a typed error for unreadable bytes', async () => {
    const result = await Effect.runPromise(
      measureContentBox(new TextEncoder().encode('not an image')).pipe(
        Effect.result,
      ),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ImageMeasureError' },
    });
  });
});
