/**
 * What the collage draws for each garment of an outfit. A measured studio
 * render is a cut-out placed by the garment inside it; a render not measured
 * yet is placed whole, margins included. A phone photo cannot be cut out, so
 * it lies as a 3:4 print, and a garment without a picture as a small square
 * of its colour. A garment no longer in the wardrobe is left out; the outfit
 * editor names it.
 */

import type { Slot } from '#/shared/data/garment-types.ts';
import type {
  ContentFraction,
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import {
  type CollagePiece,
  type CollageRect,
  layoutCollage,
} from './collage-layout.ts';

export type CollageEntry = {
  readonly slot: Slot;
  readonly garment: GarmentView | undefined;
};

export type CollageArtwork =
  | {
      readonly kind: 'cutout';
      readonly image: GarmentImageView;
      /** The garment inside the picture; the whole picture when unmeasured. */
      readonly content: ContentFraction;
    }
  | { readonly kind: 'photo'; readonly image: GarmentImageView }
  | {
      readonly kind: 'swatch';
      /** The garment's main colour; without one the swatch is left blank. */
      readonly hex: string | undefined;
    };

export type PlacedArtwork = {
  readonly slot: Slot;
  readonly artwork: CollageArtwork;
  /** Where the garment itself lies on the canvas. */
  readonly rect: CollageRect;
  /** Where the whole picture lies, so a cut-out's empty margins fall outside `rect`. */
  readonly pictureRect: CollageRect;
};

/** A photo lies as a 3:4 print. */
const printAspect = 0.75;
/** A colour square stays well inside its region, so it reads as a sample, not a garment. */
const swatchScale = 0.55;
const wholePicture: ContentFraction = { left: 0, top: 0, width: 1, height: 1 };

const artworkFor = (garment: GarmentView): CollageArtwork => {
  const { image } = garment;
  if (image === undefined) {
    return { kind: 'swatch', hex: garment.colors[0]?.hex };
  }
  return image.fit === 'contain'
    ? { kind: 'cutout', image, content: image.content ?? wholePicture }
    : { kind: 'photo', image };
};

const aspectOf = (artwork: CollageArtwork): number => {
  if (artwork.kind === 'swatch') {
    return 1;
  }
  if (artwork.kind === 'photo') {
    return printAspect;
  }
  const { image, content } = artwork;
  return image.width > 0 && image.height > 0
    ? (content.width * image.width) / (content.height * image.height)
    : printAspect;
};

const pictureRectOf = (
  rect: CollageRect,
  artwork: CollageArtwork,
): CollageRect => {
  if (artwork.kind !== 'cutout') {
    return rect;
  }
  const { content } = artwork;
  const width = rect.width / content.width;
  const height = rect.height / content.height;
  return {
    left: rect.left - content.left * width,
    top: rect.top - content.top * height,
    width,
    height,
  };
};

const present = (entries: ReadonlyArray<CollageEntry>) =>
  entries.flatMap(({ slot, garment }) =>
    garment === undefined ? [] : [{ slot, garment }],
  );

/** Whether the outfit has anything left to draw. */
export const hasCollagePieces = (entries: ReadonlyArray<CollageEntry>) =>
  present(entries).length > 0;

/** The outfit's pieces in drawing order, each with its place on the canvas. */
export const placeOutfit = (
  entries: ReadonlyArray<CollageEntry>,
): ReadonlyArray<PlacedArtwork> =>
  layoutCollage<CollagePiece & { readonly artwork: CollageArtwork }>(
    present(entries).map(({ slot, garment }) => {
      const artwork = artworkFor(garment);
      return {
        slot,
        artwork,
        aspect: aspectOf(artwork),
        scale: artwork.kind === 'swatch' ? swatchScale : 1,
      };
    }),
  ).map(({ slot, artwork, rect }) => ({
    slot,
    artwork,
    rect,
    pictureRect: pictureRectOf(rect, artwork),
  }));

/** An outfit kept as garment ids, with each garment looked up in the wardrobe. */
export const collageEntries = (
  entries: ReadonlyArray<{ readonly slot: Slot; readonly garmentId: string }>,
  wardrobe: ReadonlyArray<GarmentView>,
): ReadonlyArray<CollageEntry> =>
  entries.map((entry) => ({
    slot: entry.slot,
    garment: wardrobe.find((garment) => garment.id === entry.garmentId),
  }));

/** The collage's accessible name: the outfit, then the pieces it shows. */
export const collageLabel = (
  title: string,
  entries: ReadonlyArray<CollageEntry>,
): string => {
  const names = present(entries).map(({ garment }) => garment.name);
  return names.length === 0 ? title : `${title}: ${names.join(', ')}`;
};
