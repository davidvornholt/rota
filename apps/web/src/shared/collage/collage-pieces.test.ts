import { describe, expect, it } from 'bun:test';
import type {
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import { collageAspect } from './collage-layout.ts';
import {
  collageEntries,
  collageLabel,
  hasCollagePieces,
  placeOutfit,
} from './collage-pieces.ts';

const garment = (
  id: string,
  overrides: Partial<GarmentView> = {},
): GarmentView => ({
  id,
  status: 'active',
  name: id,
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  effectiveBudget: 2,
  colors: [{ hex: '#336699' }],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  washedOn: null,
  washedAfterWear: false,
  inLaundry: false,
  readyOn: null,
  assumedCleanOn: null,
  wearsSinceWash: 0,
  studioError: null,
  studioState: { status: 'idle' },
  image: undefined,
  original: undefined,
  studio: undefined,
  wears: 0,
  lastWornOn: null,
  daysSinceWorn: null,
  costPerWear: null,
  ...overrides,
});

const render = (
  content: GarmentImageView['content'],
  fit: GarmentImageView['fit'] = 'contain',
): GarmentImageView => ({
  url: '/media/render.png',
  srcSet: '/media/render.png 1200w',
  width: 1200,
  height: 1600,
  fit,
  content,
});

/** Width over height on the canvas, which is itself 4:5. */
const shapeOf = (rect: { readonly width: number; readonly height: number }) =>
  (rect.width * collageAspect) / rect.height;

const tee = garment('White tee', {
  image: render({ left: 0.25, top: 0.2, width: 0.5, height: 0.6 }),
});

describe('placeOutfit', () => {
  it('places a measured render by the garment inside it, its margins outside', () => {
    const [placed] = placeOutfit([{ slot: 'top', garment: tee }]);
    if (placed === undefined) {
      throw new Error('The tee was not placed.');
    }
    const { rect, pictureRect } = placed;
    // The garment is 600 by 960 pixels of the 1200 by 1600 render.
    expect(shapeOf(rect)).toBeCloseTo(600 / 960, 6);
    expect(pictureRect.width).toBeCloseTo(rect.width / 0.5, 6);
    expect(pictureRect.height).toBeCloseTo(rect.height / 0.6, 6);
    expect(pictureRect.left + 0.25 * pictureRect.width).toBeCloseTo(
      rect.left,
      6,
    );
    expect(pictureRect.top + 0.2 * pictureRect.height).toBeCloseTo(rect.top, 6);
  });

  it('places a render not measured yet whole', () => {
    const [placed] = placeOutfit([
      { slot: 'top', garment: garment('tee', { image: render(null) }) },
    ]);
    expect(placed?.artwork.kind).toBe('cutout');
    expect(placed === undefined ? 0 : shapeOf(placed.rect)).toBeCloseTo(
      3 / 4,
      6,
    );
    expect(placed?.pictureRect).toEqual(placed?.rect);
  });

  it('lays a photo as a 3:4 print', () => {
    const [placed] = placeOutfit([
      {
        slot: 'top',
        garment: garment('shirt', { image: render(null, 'cover') }),
      },
    ]);
    expect(placed?.artwork.kind).toBe('photo');
    expect(placed === undefined ? 0 : shapeOf(placed.rect)).toBeCloseTo(
      3 / 4,
      6,
    );
    expect(placed?.pictureRect).toEqual(placed?.rect);
  });

  it('shows a garment without a picture as a small square of its colour', () => {
    const placed = placeOutfit([
      { slot: 'top', garment: tee },
      { slot: 'bottom', garment: garment('chinos') },
      { slot: 'shoes', garment: garment('loafers', { colors: [] }) },
    ]);
    const chinos = placed.find((piece) => piece.slot === 'bottom');
    expect(chinos?.artwork).toEqual({ kind: 'swatch', hex: '#336699' });
    expect(chinos === undefined ? 0 : shapeOf(chinos.rect)).toBeCloseTo(1, 6);
    expect(chinos?.rect.width).toBeLessThan(0.3);
    expect(placed.find((piece) => piece.slot === 'shoes')?.artwork).toEqual({
      kind: 'swatch',
      hex: undefined,
    });
  });

  it('leaves out a garment no longer in the wardrobe', () => {
    const entries = [
      { slot: 'top', garment: tee },
      { slot: 'bottom', garment: undefined },
    ] as const;
    expect(placeOutfit(entries).map((piece) => piece.slot)).toEqual(['top']);
    expect(hasCollagePieces(entries)).toBe(true);
    expect(hasCollagePieces([{ slot: 'top', garment: undefined }])).toBe(false);
  });
});

describe('collageEntries', () => {
  it('looks every garment up in the wardrobe by id', () => {
    const trousers = garment('trousers');
    expect(
      collageEntries(
        [
          { slot: 'bottom', garmentId: 'trousers' },
          { slot: 'top', garmentId: 'gone' },
        ],
        [tee, trousers],
      ),
    ).toEqual([
      { slot: 'bottom', garment: trousers },
      { slot: 'top', garment: undefined },
    ]);
  });
});

describe('collageLabel', () => {
  it('names the outfit and the pieces the collage shows', () => {
    expect(
      collageLabel('Office', [
        { slot: 'top', garment: tee },
        { slot: 'bottom', garment: undefined },
        { slot: 'shoes', garment: garment('Black loafers') },
      ]),
    ).toBe('Office: White tee, Black loafers');
  });

  it('names only the outfit when none of its pieces is left', () => {
    expect(collageLabel('Office', [{ slot: 'top', garment: undefined }])).toBe(
      'Office',
    );
  });
});
