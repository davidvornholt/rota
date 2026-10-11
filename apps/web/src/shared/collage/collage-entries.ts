/**
 * An outfit as the pages hold it, with each garment looked up in the
 * wardrobe. The collage is made from the garments that have a picture, in
 * worn order; a garment without one or no longer in the wardrobe is left out,
 * and the outfit editor names it.
 */

import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import type {
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';

export type CollageEntry = {
  readonly slot: Slot;
  readonly garment: GarmentView | undefined;
};

export type CollageGarment = {
  readonly slot: Slot;
  readonly garment: GarmentView & { readonly image: GarmentImageView };
};

export const collageEntries = (
  entries: ReadonlyArray<{ readonly slot: Slot; readonly garmentId: string }>,
  wardrobe: ReadonlyArray<GarmentView>,
): ReadonlyArray<CollageEntry> =>
  entries.map((entry) => ({
    slot: entry.slot,
    garment: wardrobe.find((garment) => garment.id === entry.garmentId),
  }));

/** The garments the collage is made from, in worn order. */
export const collageGarments = (
  entries: ReadonlyArray<CollageEntry>,
): ReadonlyArray<CollageGarment> =>
  slotOrder.flatMap((slot) =>
    entries.flatMap(({ slot: entrySlot, garment }) => {
      const image = garment?.image;
      return entrySlot === slot && garment !== undefined && image !== undefined
        ? [{ slot, garment: { ...garment, image } }]
        : [];
    }),
  );

/** Whether the outfit has a garment to make a collage from. */
export const hasCollagePieces = (entries: ReadonlyArray<CollageEntry>) =>
  collageGarments(entries).length > 0;

/** The collage's accessible name: the outfit, then the pieces it shows. */
export const collageLabel = (
  title: string,
  entries: ReadonlyArray<CollageEntry>,
): string => {
  const names = collageGarments(entries).map(({ garment }) => garment.name);
  return names.length === 0 ? title : `${title}: ${names.join(', ')}`;
};
