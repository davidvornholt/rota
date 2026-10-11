/**
 * The collage as a PNG to share or keep. It draws the same layout the page
 * shows onto a canvas, piece by piece, from the stored pictures.
 */

import { Effect, Schema } from 'effect';
import type { GarmentImageView } from '#/shared/data/garment-view.ts';
import type { CollageRect } from './collage-layout.ts';
import {
  type CollageEntry,
  type PlacedArtwork,
  placeOutfit,
} from './collage-pieces.ts';

/** 4:5 at the width messaging apps keep, so the picture is not scaled down again. */
export const pictureWidth = 1080;
export const pictureHeight = 1350;

export class CollagePictureError extends Schema.TaggedError<CollagePictureError>()(
  'CollagePictureError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

const srcSetCandidate = /^(?<url>\S+)\s+(?<width>\d+)w$/u;

/**
 * The smallest copy in a `srcset` at least `needed` pixels wide, else the
 * widest one, else the original.
 */
export const sourceFor = (image: GarmentImageView, needed: number): string => {
  const candidates = image.srcSet
    .split(',')
    .flatMap((candidate) => {
      const match = srcSetCandidate.exec(candidate.trim());
      return match?.groups?.url === undefined
        ? []
        : [{ url: match.groups.url, width: Number(match.groups.width) }];
    })
    .sort((left, right) => left.width - right.width);
  return (
    candidates.find((candidate) => candidate.width >= needed)?.url ??
    candidates.at(-1)?.url ??
    image.url
  );
};

const loadImage = (url: string) =>
  Effect.callback<HTMLImageElement, CollagePictureError>((resume) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resume(Effect.succeed(image));
    image.onerror = (cause) =>
      resume(
        Effect.fail(
          new CollagePictureError({
            message: 'A garment picture could not be loaded. Try again.',
            cause,
          }),
        ),
      );
    image.src = url;
    return Effect.sync(() => {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    });
  });

const pixels = (rect: CollageRect) => ({
  x: rect.left * pictureWidth,
  y: rect.top * pictureHeight,
  width: rect.width * pictureWidth,
  height: rect.height * pictureHeight,
});

/** The centred part of a picture with the frame's shape, as `object-fit: cover` crops. */
const coverCrop = (
  image: HTMLImageElement,
  frame: { readonly width: number; readonly height: number },
) => {
  const scale = Math.max(
    frame.width / image.naturalWidth,
    frame.height / image.naturalHeight,
  );
  const width = frame.width / scale;
  const height = frame.height / scale;
  return {
    x: (image.naturalWidth - width) / 2,
    y: (image.naturalHeight - height) / 2,
    width,
    height,
  };
};

type Colours = {
  /** The paper the pieces lie on. */
  readonly paper: string;
  /** A garment with neither picture nor colour. */
  readonly blank: string;
};

const draw = (
  context: CanvasRenderingContext2D,
  piece: PlacedArtwork,
  image: HTMLImageElement | undefined,
  colours: Colours,
) => {
  const { artwork } = piece;
  if (artwork.kind === 'swatch' || image === undefined) {
    const frame = pixels(piece.rect);
    context.fillStyle =
      artwork.kind === 'swatch' && artwork.hex !== undefined
        ? artwork.hex
        : colours.blank;
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
    return;
  }
  const frame = pixels(piece.pictureRect);
  if (artwork.kind === 'photo') {
    const crop = coverCrop(image, frame);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
    );
    return;
  }
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
};

const canvasFailure = (cause: unknown) =>
  new CollagePictureError({
    message: 'This browser could not draw the outfit picture.',
    cause,
  });

const encode = (canvas: HTMLCanvasElement) =>
  Effect.callback<Blob, CollagePictureError>((resume) => {
    canvas.toBlob((blob) => {
      resume(
        blob === null
          ? Effect.fail(canvasFailure(undefined))
          : Effect.succeed(blob),
      );
    }, 'image/png');
  });

/** Draws the outfit at 1080 by 1350 and answers it as a PNG. */
export const drawCollagePicture = (
  entries: ReadonlyArray<CollageEntry>,
  colours: Colours,
): Effect.Effect<Blob, CollagePictureError> =>
  Effect.gen(function* () {
    const pieces = placeOutfit(entries);
    const images = yield* Effect.forEach(
      pieces,
      ({ artwork, pictureRect }) =>
        artwork.kind === 'swatch'
          ? Effect.succeed(undefined)
          : loadImage(
              sourceFor(artwork.image, pictureRect.width * pictureWidth),
            ),
      { concurrency: 'unbounded' },
    );
    const canvas = document.createElement('canvas');
    canvas.width = pictureWidth;
    canvas.height = pictureHeight;
    const context = canvas.getContext('2d');
    if (context === null) {
      return yield* canvasFailure(undefined);
    }
    // A canvas ignores a colour it cannot parse; white is the nearest stand-in
    // for the paper where a browser does not read the theme's oklch yet.
    context.fillStyle = '#ffffff';
    context.fillStyle = colours.paper;
    context.fillRect(0, 0, pictureWidth, pictureHeight);
    pieces.forEach((piece, index) => {
      draw(context, piece, images[index], colours);
    });
    return yield* encode(canvas);
  });
