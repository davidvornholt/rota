/**
 * The garments an outfit's collage is made from, on the server. Each piece is
 * the garment's displayed picture, so choosing another picture or rendering a
 * new one asks for a new collage. A garment without a picture or no longer in
 * the wardrobe is left out; the outfit editor names it.
 */

import {
  displayImage,
  type Garment,
  type GarmentImage,
} from '#/shared/data/garment.ts';
import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';

export type CollagePiece = {
  readonly slot: Slot;
  readonly name: string;
  readonly image: GarmentImage;
};

export const collagePieces = (
  entries: ReadonlyArray<{ readonly slot: Slot; readonly garmentId: string }>,
  garments: ReadonlyArray<Garment>,
): ReadonlyArray<CollagePiece> =>
  slotOrder.flatMap((slot) =>
    entries
      .filter((entry) => entry.slot === slot)
      .flatMap((entry) => {
        const garment = garments.find(
          (candidate) => candidate.id === entry.garmentId,
        );
        const image = garment === undefined ? undefined : displayImage(garment);
        return garment === undefined || image === undefined
          ? []
          : [{ slot, name: garment.name, image }];
      }),
  );

/** Names the combination a collage shows: outfits with the same pieces share one picture. */
export const piecesKey = (pieces: ReadonlyArray<CollagePiece>): string =>
  pieces.map((piece) => `${piece.slot}:${piece.image.key}`).join(' ');
