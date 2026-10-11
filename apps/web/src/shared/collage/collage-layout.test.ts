import { describe, expect, it } from 'bun:test';
import type { Slot } from '#/shared/data/garment-types.ts';
import {
  type CollageRect,
  collageAspect,
  layoutCollage,
} from './collage-layout.ts';

const piece = (slot: Slot, aspect: number, scale = 1) => ({
  slot,
  aspect,
  scale,
});

/** Width over height on the canvas, which is itself 4:5. */
const shapeOf = (rect: CollageRect) =>
  (rect.width * collageAspect) / rect.height;

const centreX = (rect: CollageRect) => rect.left + rect.width / 2;

const rectOf = (
  placed: ReadonlyArray<{ readonly slot: Slot; readonly rect: CollageRect }>,
  slot: Slot,
) => {
  const found = placed.find((candidate) => candidate.slot === slot);
  if (found === undefined) {
    throw new Error(`No ${slot} was placed.`);
  }
  return found.rect;
};

const outfit = [
  piece('shoes', 1.8),
  piece('top', 1.07),
  piece('bag', 0.6),
  piece('bottom', 0.42),
  piece('over', 0.84),
  piece('under', 1),
];

describe('layoutCollage', () => {
  it('draws lower layers first and shoes and bag above the clothes', () => {
    expect(layoutCollage(outfit).map((placed) => placed.slot)).toEqual([
      'bottom',
      'over',
      'under',
      'top',
      'bag',
      'shoes',
    ]);
  });

  it('places at most one piece per slot, the first one given', () => {
    const placed = layoutCollage([
      { ...piece('top', 1), name: 'first' },
      { ...piece('top', 1), name: 'second' },
    ]);
    expect(placed.map((candidate) => candidate.name)).toEqual(['first']);
  });

  it('keeps every piece in its shape and inside the margin', () => {
    const placed = layoutCollage(outfit);
    for (const { aspect, rect } of placed) {
      expect(shapeOf(rect)).toBeCloseTo(aspect, 6);
      expect(rect.left).toBeGreaterThanOrEqual(6 / 100 - 1e-9);
      expect(rect.top).toBeGreaterThanOrEqual(6 / 125 - 1e-9);
      expect(rect.left + rect.width).toBeLessThanOrEqual(1 - 6 / 100 + 1e-9);
      expect(rect.top + rect.height).toBeLessThanOrEqual(1 - 6 / 125 + 1e-9);
    }
  });

  it('lays an over layer to the left with the top across its edge and the bottom on the right', () => {
    const placed = layoutCollage(outfit);
    const over = rectOf(placed, 'over');
    const top = rectOf(placed, 'top');
    const bottom = rectOf(placed, 'bottom');
    expect(top.left).toBeGreaterThan(over.left);
    expect(top.left).toBeLessThan(over.left + over.width);
    expect(centreX(bottom)).toBeGreaterThan(centreX(over));
  });

  it('lays a single layer as worn, the bottom coming out from under the top', () => {
    const placed = layoutCollage([piece('top', 1.07), piece('bottom', 0.42)]);
    const top = rectOf(placed, 'top');
    const bottom = rectOf(placed, 'bottom');
    expect(centreX(top)).toBeCloseTo(0.5, 6);
    expect(centreX(bottom)).toBeCloseTo(0.5, 6);
    expect(bottom.top).toBeGreaterThan(top.top);
    expect(bottom.top).toBeLessThan(top.top + top.height);
  });

  it('grows a lone piece to fill the canvas, but no more than a third again', () => {
    const [placed] = layoutCollage([piece('top', 1)]);
    // The top's region fits a square 50 grid units wide; it grows by 1.35.
    expect(placed?.rect.width).toBeCloseTo(0.675, 6);
    expect(placed === undefined ? 0 : centreX(placed.rect)).toBeCloseTo(0.5, 6);
  });

  it('shrinks a piece by its scale', () => {
    const [whole] = layoutCollage([piece('top', 1)]);
    const [half] = layoutCollage([piece('top', 1, 0.5)]);
    expect(half?.rect.width).toBeCloseTo((whole?.rect.width ?? 0) / 2, 6);
  });

  it('keeps a shrunken bottom clear of the tops above it', () => {
    const single = layoutCollage([
      piece('top', 0.75),
      piece('bottom', 1, 0.55),
    ]);
    const layers = layoutCollage([
      piece('over', 0.75),
      piece('top', 0.75),
      piece('bottom', 1, 0.55),
    ]);
    for (const placed of [single, layers]) {
      const bottom = rectOf(placed, 'bottom');
      for (const above of placed.filter(({ slot }) => slot !== 'bottom')) {
        const clearBelow = bottom.top >= above.rect.top + above.rect.height;
        const clearBeside = bottom.left >= above.rect.left + above.rect.width;
        expect(clearBelow || clearBeside).toBe(true);
      }
    }
  });

  it('draws a piece with an unusable shape as a 3:4 card', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const [placed] = layoutCollage([piece('top', aspect)]);
      expect(placed === undefined ? 0 : shapeOf(placed.rect)).toBeCloseTo(
        3 / 4,
        6,
      );
    }
  });

  it('places nothing for an empty outfit', () => {
    expect(layoutCollage([])).toEqual([]);
  });
});
