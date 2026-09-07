import { describe, expect, it } from 'bun:test';
import { Effect, Schema } from 'effect';
import sharp from 'sharp';
import { ImageRotationSchema, rotateImage } from './rotate-image.ts';

const topLeft = 10;
const topRight = 20;
const middleLeft = 30;
const middleRight = 40;
const bottomLeft = 50;
const bottomRight = 60;
const quarterTurn = 90;
const halfTurn = 180;
const partialTurn = 45;
const fullTurn = 360;
const sourcePixels = [
  topLeft,
  topRight,
  middleLeft,
  middleRight,
  bottomLeft,
  bottomRight,
];
const sourceWidth = 2;
const sourceHeight = 3;
const channels = 3;
const rgb = (values: ReadonlyArray<number>) =>
  new Uint8Array(values.flatMap((value) => [value, value, value]));
const source = () =>
  sharp(rgb(sourcePixels), {
    raw: { width: sourceWidth, height: sourceHeight, channels },
  });
const oversizedSource = () =>
  sharp({
    create: {
      width: 2049,
      height: 2048,
      channels,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

describe('source photo rotation', () => {
  it.each([
    { rotation: 0, width: 2, height: 3, pixels: sourcePixels },
    {
      rotation: 90,
      width: 3,
      height: 2,
      pixels: [
        bottomLeft,
        middleLeft,
        topLeft,
        bottomRight,
        middleRight,
        topRight,
      ],
    },
    {
      rotation: 180,
      width: 2,
      height: 3,
      pixels: [
        bottomRight,
        bottomLeft,
        middleRight,
        middleLeft,
        topRight,
        topLeft,
      ],
    },
    {
      rotation: 270,
      width: 3,
      height: 2,
      pixels: [
        topRight,
        middleRight,
        bottomRight,
        topLeft,
        middleLeft,
        bottomLeft,
      ],
    },
  ] as const)(
    'rotates $rotation degrees clockwise without cropping or distorting pixels',
    async ({ rotation, width, height, pixels }) => {
      const bytes = new Uint8Array(await source().png().toBuffer());
      const original = bytes.slice();
      const result = await Effect.runPromise(
        rotateImage({ bytes, mime: 'image/png' }, rotation),
      );
      const decoded = await sharp(result.bytes)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(decoded.info).toMatchObject({ width, height, channels });
      expect(new Uint8Array(decoded.data)).toEqual(rgb(pixels));
      expect(bytes).toEqual(original);
    },
  );

  it('passes an upright photo through without re-encoding', async () => {
    const photo = {
      bytes: await source().jpeg().toBuffer(),
      mime: 'image/jpeg',
    };
    expect(await Effect.runPromise(rotateImage(photo, 0))).toBe(photo);
  });

  it('rejects source photos over the pixel limit before rotating', async () => {
    const bytes = await oversizedSource();

    const result = await Effect.runPromise(
      rotateImage({ bytes, mime: 'image/png' }, quarterTurn).pipe(
        Effect.either,
      ),
    );
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ImageRotationError' },
    });
  });

  it.each(['jpeg', 'webp'] as const)(
    'returns matching PNG bytes and MIME when rotating %s input',
    async (format) => {
      const result = await Effect.runPromise(
        rotateImage(
          {
            bytes: await source().toFormat(format).toBuffer(),
            mime: `image/${format}`,
          },
          quarterTurn,
        ),
      );
      expect(result.mime).toBe('image/png');
      expect(await sharp(result.bytes).metadata()).toMatchObject({
        format: 'png',
        width: sourceHeight,
        height: sourceWidth,
      });
    },
  );

  it('returns a typed failure for unreadable photo bytes', async () => {
    const result = await Effect.runPromise(
      rotateImage(
        { bytes: new Uint8Array([1]), mime: 'image/png' },
        halfTurn,
      ).pipe(Effect.either),
    );
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ImageRotationError' },
    });
  });

  it.each([-quarterTurn, partialTurn, fullTurn, '180', null])(
    'rejects unsupported rotation %s',
    (value) => {
      expect(Schema.is(ImageRotationSchema)(value)).toBe(false);
    },
  );
});
