/**
 * Where each piece of an outfit sits in a flat-lay collage. Every slot has a
 * fixed region in one of two templates, chosen by whether an over layer is
 * worn; a piece fills its region as far as its shape allows and leans to the
 * region's anchor. The finished composition is then scaled and centred on the
 * canvas, so an outfit with fewer pieces still fills it.
 *
 * Pure geometry: the component and the image export draw from the same
 * rectangles, so the shared picture matches the one on screen.
 */

import type { Slot } from '#/shared/data/garment-types.ts';

/** Regions are authored on a 100 by 125 grid, the canvas at its 4:5 shape. */
const gridWidth = 100;
const gridHeight = 125;
/** The collage is a 4:5 portrait, the shape messaging apps show uncropped. */
export const collageAspect = gridWidth / gridHeight;
/** A piece with an unusable shape is drawn as a 3:4 card. */
const cardAspect = 0.75;
/** The finished composition keeps this much paper on every side, in grid units. */
const margin = 6;
/** A sparse outfit grows to fill the canvas, but no piece grows past this. */
const maximumGrowth = 1.35;

type Anchor = 'start' | 'center' | 'end';

type Region = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly alignX: Anchor;
  readonly alignY: Anchor;
};

/**
 * Without an over layer the outfit lies as worn: the top at the upper centre
 * with the bottom coming out from under its hem, the shoes beside the bottom's
 * foot on the right and the bag in the free corner on the left.
 */
const singleLayer: Readonly<Record<Exclude<Slot, 'over'>, Region>> = {
  top: {
    x: 14,
    y: 3,
    width: 72,
    height: 50,
    alignX: 'center',
    alignY: 'start',
  },
  under: { x: 70, y: 2, width: 28, height: 28, alignX: 'end', alignY: 'start' },
  bottom: {
    x: 28,
    y: 38,
    width: 44,
    height: 84,
    alignX: 'center',
    alignY: 'start',
  },
  shoes: { x: 64, y: 94, width: 34, height: 28, alignX: 'end', alignY: 'end' },
  bag: {
    x: 2,
    y: 72,
    width: 30,
    height: 32,
    alignX: 'start',
    alignY: 'center',
  },
};

/**
 * With an over layer it lies at the upper left, the top overlaps its right
 * edge, and the bottom comes out from under both on the right; shoes and bag
 * move to the free left side.
 */
const layered: Readonly<Record<Slot, Region>> = {
  over: { x: 2, y: 8, width: 50, height: 56, alignX: 'start', alignY: 'start' },
  top: {
    x: 28,
    y: 2,
    width: 50,
    height: 46,
    alignX: 'center',
    alignY: 'start',
  },
  under: { x: 70, y: 2, width: 28, height: 28, alignX: 'end', alignY: 'start' },
  bottom: {
    x: 46,
    y: 34,
    width: 44,
    height: 88,
    alignX: 'center',
    alignY: 'start',
  },
  shoes: { x: 4, y: 96, width: 40, height: 26, alignX: 'start', alignY: 'end' },
  bag: {
    x: 4,
    y: 66,
    width: 32,
    height: 30,
    alignX: 'start',
    alignY: 'center',
  },
};

const regionFor = (slot: Slot, hasOver: boolean): Region => {
  if (hasOver || slot === 'over') {
    return layered[slot];
  }
  return singleLayer[slot];
};

/** Lower layers first, so a piece worn above another also lies above it. */
const stacking: ReadonlyArray<Slot> = [
  'bottom',
  'over',
  'under',
  'top',
  'bag',
  'shoes',
];

/** A rectangle as fractions of the canvas width (left, width) and height (top, height). */
export type CollageRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type CollagePiece = {
  readonly slot: Slot;
  /** Width over height of what the collage shows of the piece. */
  readonly aspect: number;
  /**
   * How much of its region the piece fills, from 0 to 1. Below 1 the piece is
   * centred in its region instead of leaning to the region's anchor.
   */
  readonly scale: number;
};

type GridRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const offset = (room: number, anchor: Anchor) => {
  if (anchor === 'start') {
    return 0;
  }
  return anchor === 'center' ? room / 2 : room;
};

const fitInto = (area: Region, aspect: number, scale: number): GridRect => {
  const width = Math.min(area.width, area.height * aspect) * scale;
  const height = width / aspect;
  // A piece drawn smaller than it could be sits in the middle of its region,
  // clear of the neighbours its full size would reach under.
  const shrunk = scale < 1;
  return {
    x: area.x + offset(area.width - width, shrunk ? 'center' : area.alignX),
    y: area.y + offset(area.height - height, shrunk ? 'center' : area.alignY),
    width,
    height,
  };
};

const bounds = (rects: ReadonlyArray<GridRect>): GridRect => {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * Places the pieces, at most one per slot, and answers them in drawing order
 * with their rectangles. A piece with an unusable shape is drawn as a 3:4 card.
 */
export const layoutCollage = <Piece extends CollagePiece>(
  pieces: ReadonlyArray<Piece>,
): ReadonlyArray<Piece & { readonly rect: CollageRect }> => {
  const ordered = stacking.flatMap((slot) => {
    const piece = pieces.find((candidate) => candidate.slot === slot);
    return piece === undefined ? [] : [piece];
  });
  if (ordered.length === 0) {
    return [];
  }
  const hasOver = ordered.some((piece) => piece.slot === 'over');
  const placed = ordered.map((piece) => ({
    piece,
    rect: fitInto(
      regionFor(piece.slot, hasOver),
      Number.isFinite(piece.aspect) && piece.aspect > 0
        ? piece.aspect
        : cardAspect,
      piece.scale,
    ),
  }));
  const all = bounds(placed.map(({ rect }) => rect));
  const scale = Math.min(
    (gridWidth - 2 * margin) / all.width,
    (gridHeight - 2 * margin) / all.height,
    maximumGrowth,
  );
  const shiftX = (gridWidth - all.width * scale) / 2 - all.x * scale;
  const shiftY = (gridHeight - all.height * scale) / 2 - all.y * scale;
  return placed.map(({ piece, rect }) => ({
    ...piece,
    rect: {
      left: (rect.x * scale + shiftX) / gridWidth,
      top: (rect.y * scale + shiftY) / gridHeight,
      width: (rect.width * scale) / gridWidth,
      height: (rect.height * scale) / gridHeight,
    },
  }));
};
