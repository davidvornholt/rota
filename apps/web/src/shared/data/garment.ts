import { Schema } from 'effect';

import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import {
  type GarmentCategory,
  type GarmentColor,
  type GarmentStatus,
  garmentCategories,
  type ImageChoice,
  type Slot,
  scaleMaximum,
  scaleMinimum,
} from './garment-types.ts';
import { UuidSchema } from './uuid-schema.ts';

export const SlotSchema: Schema.Codec<Slot> = Schema.Literals([
  'bottom',
  'under',
  'top',
  'over',
  'shoes',
  'bag',
]);

export const GarmentStatusSchema: Schema.Codec<GarmentStatus> = Schema.Literals(
  ['processing', 'review', 'active', 'retired'],
);

export const ImageChoiceSchema: Schema.Codec<ImageChoice> = Schema.Literals([
  'studio',
  'original',
]);

const hexColor = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/u));

/**
 * A colour is exactly `{ hex }`. Decoding a struct strips unknown keys, so the
 * record form keeps them visible long enough to reject the retired `name`.
 */
export const GarmentColorSchema = Schema.Record(Schema.String, hexColor).pipe(
  Schema.refine(
    (color): color is GarmentColor =>
      Object.keys(color).length === 1 && Object.hasOwn(color, 'hex'),
    { expected: 'a colour with only a hex value' },
  ),
);

export const GarmentCategorySchema: Schema.Codec<GarmentCategory> =
  Schema.Literals(garmentCategories);

export const GarmentImageSchema = Schema.Struct({
  key: Schema.String,
  mime: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
});
export type GarmentImage = Schema.Schema.Type<typeof GarmentImageSchema>;

export const GarmentScaleSchema = Schema.Int.check(
  Schema.isBetween({ minimum: scaleMinimum, maximum: scaleMaximum }),
);

const NumericFromRow = Schema.NullOr(Schema.NumberFromString);

/**
 * A garment as the repository hands it out. `images` carries whichever of the
 * two stored images exist; `wearBudget` is null when the category default
 * applies. The row shape is Postgres's: snake_case, `numeric` as text, arrays
 * already parsed, jsonb already objects.
 */
export const GarmentFromRow = Schema.Struct({
  id: UuidSchema,
  status: GarmentStatusSchema,
  name: Schema.String,
  category: Schema.String,
  subcategory: Schema.String,
  slots: Schema.Array(SlotSchema),
  warmth: GarmentScaleSchema,
  rainOk: Schema.Boolean,
  formality: GarmentScaleSchema,
  wearBudget: Schema.NullOr(Schema.Number),
  washedOn: Schema.NullOr(LocalDateSchema),
  washedAfterWear: Schema.Boolean,
  laundryStartedOn: Schema.NullOr(LocalDateSchema),
  laundryReadyOn: Schema.NullOr(LocalDateSchema),
  colors: Schema.Array(GarmentColorSchema),
  pattern: Schema.String,
  material: Schema.String,
  fit: Schema.String,
  sleeve: Schema.String,
  brand: Schema.String,
  notes: Schema.String,
  price: NumericFromRow,
  purchasedOn: Schema.NullOr(LocalDateSchema),
  imageChoice: ImageChoiceSchema,
  processingError: Schema.NullOr(Schema.String),
  studioError: Schema.NullOr(Schema.String),
  retiredAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  images: Schema.Struct({
    original: Schema.optional(GarmentImageSchema),
    studio: Schema.optional(GarmentImageSchema),
  }),
}).pipe(
  Schema.encodeKeys({
    rainOk: 'rain_ok',
    wearBudget: 'wear_budget',
    washedOn: 'washed_on',
    washedAfterWear: 'washed_after_wear',
    laundryStartedOn: 'laundry_started_on',
    laundryReadyOn: 'laundry_ready_on',
    purchasedOn: 'purchased_on',
    imageChoice: 'image_choice',
    processingError: 'processing_error',
    studioError: 'studio_error',
    retiredAt: 'retired_at',
    createdAt: 'created_at',
  }),
);

export type Garment = Schema.Schema.Type<typeof GarmentFromRow>;

/** The image the wardrobe shows: the chosen kind when it exists, else the other. */
export const displayImage = (garment: Garment): GarmentImage | undefined =>
  garment.imageChoice === 'studio'
    ? (garment.images.studio ?? garment.images.original)
    : (garment.images.original ?? garment.images.studio);
