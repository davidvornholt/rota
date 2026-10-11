import { Effect, Schema } from 'effect';
import sharp from 'sharp';
import { maximumSourcePixels } from './image-limits.ts';

/** The pixel rectangle a garment fills inside a studio render. */
export type ContentBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export class ImageMeasureError extends Schema.TaggedError<ImageMeasureError>()(
  'ImageMeasureError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

/**
 * Measured on a small copy: the faint specks a render leaves in its margins
 * average away, and a 1600-pixel render reads in a fraction of the time.
 */
const measureWidth = 300;
const rgba = 4;
const alphaChannel = 3;
const opaqueAlpha = 255;
/** How opaque a pixel of the small copy must be to count as garment. */
const alphaThreshold = 32;
/** How far from the ground colour a pixel must be when the render has no transparency. */
const colourThreshold = 24;
/** A row or column needs this many garment pixels, so a lone speck cannot widen the box. */
const minimumPixelsPerLine = 2;

type Pixels = {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
};

/**
 * A transparent render separates garment from ground by alpha. A render the
 * image service made opaque sits on one flat colour, so the corner pixel is
 * the ground and anything clearly different is garment.
 */
const garmentTest = ({ data }: Pixels): ((offset: number) => boolean) => {
  if ((data[alphaChannel] ?? opaqueAlpha) < opaqueAlpha) {
    return (offset) => (data[offset + alphaChannel] ?? 0) >= alphaThreshold;
  }
  const ground = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
  return (offset) =>
    ground.some(
      (value, channel) =>
        Math.abs((data[offset + channel] ?? 0) - value) > colourThreshold,
    );
};

const firstAndLast = (counts: ReadonlyArray<number>) => {
  const filled = (count: number) => count >= minimumPixelsPerLine;
  const first = counts.findIndex(filled);
  const last = counts.reduce(
    (found, count, index) => (filled(count) ? index : found),
    first,
  );
  return first === -1 ? undefined : { first, last };
};

/** The box in the small copy's pixels, or undefined when nothing stands out. */
const boxOf = (pixels: Pixels) => {
  const isGarment = garmentTest(pixels);
  const columns = Array.from({ length: pixels.width }, () => 0);
  const rows = Array.from({ length: pixels.height }, () => 0);
  for (let y = 0; y < pixels.height; y += 1) {
    for (let x = 0; x < pixels.width; x += 1) {
      if (isGarment((y * pixels.width + x) * rgba)) {
        columns[x] = (columns[x] ?? 0) + 1;
        rows[y] = (rows[y] ?? 0) + 1;
      }
    }
  }
  const across = firstAndLast(columns);
  const down = firstAndLast(rows);
  return across === undefined || down === undefined
    ? undefined
    : { across, down };
};

const read = async (bytes: Uint8Array) => {
  const { data, info } = await sharp(bytes, {
    limitInputPixels: maximumSourcePixels,
  })
    .resize({ width: measureWidth, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const metadata = await sharp(bytes).metadata();
  return {
    pixels: { data, width: info.width, height: info.height },
    width: metadata.width,
    height: metadata.height,
  };
};

/**
 * Finds the rectangle the garment fills in a studio render, in the render's
 * own pixels, so a collage can crop the empty margins away.
 */
export const measureContentBox = (
  bytes: Uint8Array,
): Effect.Effect<ContentBox, ImageMeasureError> =>
  Effect.tryPromise({
    try: () => read(bytes),
    catch: (cause) =>
      new ImageMeasureError({
        message: 'The studio picture could not be read to find the garment.',
        cause,
      }),
  }).pipe(
    Effect.flatMap(({ pixels, width, height }) => {
      const box = boxOf(pixels);
      if (box === undefined) {
        return Effect.fail(
          new ImageMeasureError({
            message: 'The studio picture shows no garment to place.',
            cause: undefined,
          }),
        );
      }
      const scaleX = width / pixels.width;
      const scaleY = height / pixels.height;
      const left = Math.floor(box.across.first * scaleX);
      const top = Math.floor(box.down.first * scaleY);
      const right = Math.min(width, Math.ceil((box.across.last + 1) * scaleX));
      const bottom = Math.min(height, Math.ceil((box.down.last + 1) * scaleY));
      return Effect.succeed({
        left,
        top,
        width: right - left,
        height: bottom - top,
      });
    }),
  );
