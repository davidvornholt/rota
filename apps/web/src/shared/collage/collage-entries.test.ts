import { expect, it } from 'bun:test';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import {
  collageEntries,
  collageGarments,
  collageLabel,
  hasCollagePieces,
} from './collage-entries.ts';

const view = (id: string, name: string, pictured: boolean) =>
  ({
    id,
    name,
    image: pictured
      ? {
          url: `/api/media/${id}.png`,
          srcSet: '',
          width: 300,
          height: 400,
          fit: 'contain',
        }
      : undefined,
  }) as GarmentView;

const wardrobe = [
  view('shirt', 'Blue Oxford shirt', true),
  view('chinos', 'Sand chinos', true),
  view('tee', 'Grey tee', false),
];

it('makes the collage from pictured garments in worn order and names only those', () => {
  const entries = collageEntries(
    [
      { slot: 'top', garmentId: 'shirt' },
      { slot: 'under', garmentId: 'tee' },
      { slot: 'shoes', garmentId: 'gone' },
      { slot: 'bottom', garmentId: 'chinos' },
    ],
    wardrobe,
  );
  expect(collageGarments(entries).map(({ slot }) => slot)).toEqual([
    'bottom',
    'top',
  ]);
  expect(collageLabel('Weekend', entries)).toBe(
    'Weekend: Sand chinos, Blue Oxford shirt',
  );
});

it('has no pieces when no garment has a picture', () => {
  const entries = collageEntries(
    [{ slot: 'under', garmentId: 'tee' }],
    wardrobe,
  );
  expect(hasCollagePieces(entries)).toBe(false);
  expect(collageLabel('Rest day', entries)).toBe('Rest day');
});
