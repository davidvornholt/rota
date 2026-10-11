import { Schema } from 'effect';
import type { StudioProgress } from '#/shared/ai/studio-progress.ts';
import { SlotSchema } from '#/shared/data/garment.ts';
import { slotOrder } from '#/shared/data/garment-types.ts';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';

export type CollagePicture = {
  readonly url: string;
  readonly srcSet: string;
  readonly width: number;
  readonly height: number;
};

/** Where an outfit's collage stands; `empty` when none of its garments has a picture. */
export type CollageState =
  | { readonly status: 'empty' }
  | { readonly status: 'pending'; readonly progress: StudioProgress }
  | { readonly status: 'ready'; readonly picture: CollagePicture }
  | { readonly status: 'failed'; readonly message: string };

const CollageRequestEntrySchema = Schema.Struct({
  slot: SlotSchema,
  garmentId: UuidSchema,
  imageUrl: Schema.String,
});

/** Pins the picture shown by the page, even if the wardrobe changes later. */
export type CollageRequestEntry = Schema.Schema.Type<
  typeof CollageRequestEntrySchema
>;

/** `retry` makes a new attempt after a failed one; otherwise a failure is answered as stored. */
export const decodeCollageRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    entries: Schema.Array(CollageRequestEntrySchema).check(
      Schema.isMaxLength(slotOrder.length),
    ),
    retry: Schema.Boolean,
  }),
);
