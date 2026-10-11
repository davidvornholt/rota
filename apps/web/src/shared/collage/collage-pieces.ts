/**
 * Resolves the page's pictured garments against the owner's wardrobe. A
 * changed selection can still use the requested original or studio picture;
 * a picture no longer attached to that garment fails the whole request.
 */

import { Effect } from 'effect';
import { CollageError } from '#/shared/ai/errors/ai-errors.ts';
import type { Garment, GarmentImage } from '#/shared/data/garment.ts';
import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import type { CollageRequestEntry } from './collage-state.ts';

export type CollagePiece = {
  readonly slot: Slot;
  readonly name: string;
  readonly image: GarmentImage;
};

export const collagePieces = Effect.fnUntraced(function* (
  entries: ReadonlyArray<CollageRequestEntry>,
  garments: ReadonlyArray<Garment>,
  urlFor: (key: string) => string,
): Effect.fn.Return<ReadonlyArray<CollagePiece>, CollageError> {
  const pieces: Array<CollagePiece> = [];
  for (const slot of slotOrder) {
    for (const entry of entries.filter(
      (candidate) => candidate.slot === slot,
    )) {
      const garment = garments.find(
        (candidate) => candidate.id === entry.garmentId,
      );
      const image = [garment?.images.original, garment?.images.studio].find(
        (candidate) =>
          candidate !== undefined && urlFor(candidate.key) === entry.imageUrl,
      );
      if (garment === undefined || image === undefined) {
        return yield* new CollageError({
          message:
            'A picture in this outfit is no longer available. Refresh the page to use the current pictures.',
          cause:
            'The requested picture is not attached to this garment in the wardrobe.',
        });
      }
      pieces.push({ slot, name: garment.name, image });
    }
  }
  return pieces;
});

/** Names the combination a collage shows: outfits with the same pieces share one picture. */
export const piecesKey = (pieces: ReadonlyArray<CollagePiece>): string =>
  pieces.map((piece) => `${piece.slot}:${piece.image.key}`).join(' ');
