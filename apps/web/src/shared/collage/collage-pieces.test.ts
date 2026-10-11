import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { CollageError } from '#/shared/ai/errors/ai-errors.ts';
import type { Garment } from '#/shared/data/garment.ts';
import { mediaUrl } from '#/shared/media/media-variants.ts';
import { collagePieces } from './collage-pieces.ts';

const original = {
  key: 'original.png',
  mime: 'image/png',
  width: 300,
  height: 400,
};
const studio = { ...original, key: 'studio.png' };
const garment: Garment = {
  id: 'shirt',
  status: 'active',
  name: 'Shirt',
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  warmth: 2,
  rainOk: false,
  formality: 2,
  wearBudget: null,
  colors: [],
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
  laundryStartedOn: null,
  laundryReadyOn: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date(),
  images: { original, studio },
};

it('keeps the displayed picture across selection changes and rejects unavailable or unowned pictures', () => {
  const request = [
    { slot: 'top', garmentId: garment.id, imageUrl: mediaUrl(original.key) },
  ] as const;
  expect(Effect.runSync(collagePieces(request, [garment], mediaUrl))).toEqual([
    { slot: 'top', name: garment.name, image: original },
  ]);
  const validEntry = {
    slot: 'bottom',
    garmentId: garment.id,
    imageUrl: mediaUrl(studio.key),
  } as const;
  for (const unavailable of [
    { ...request[0], imageUrl: mediaUrl('replaced-studio.png') },
    { ...request[0], garmentId: 'another-owner-garment' },
    { ...request[0], imageUrl: 'https://example.com/arbitrary.png' },
  ]) {
    const result = Effect.runSync(
      collagePieces([validEntry, unavailable], [garment], mediaUrl).pipe(
        Effect.flip,
      ),
    );
    expect(result).toBeInstanceOf(CollageError);
    expect(result.message).toContain('Refresh the page');
  }
});
