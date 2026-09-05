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

export const SlotSchema: Schema.Schema<Slot> = Schema.Literal(
  'bottom',
  'under',
  'top',
  'over',
);

export const GarmentStatusSchema: Schema.Schema<GarmentStatus> = Schema.Literal(
  'processing',
  'review',
  'active',
  'retired',
);

export const ImageChoiceSchema: Schema.Schema<ImageChoice> = Schema.Literal(
  'studio',
  'original',
);

export const GarmentColorSchema: Schema.Schema<GarmentColor> = Schema.Struct({
  name: Schema.String,
  hex: Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/u)),
});

export const GarmentCategorySchema: Schema.Schema<GarmentCategory> =
  Schema.Literal(...garmentCategories);

export const GarmentImageSchema = Schema.Struct({
  key: Schema.String,
  mime: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
});
export type GarmentImage = Schema.Schema.Type<typeof GarmentImageSchema>;

export const GarmentScaleSchema = Schema.Int.pipe(
  Schema.between(scaleMinimum, scaleMaximum),
);

const NumericFromRow = Schema.NullOr(Schema.NumberFromString);

/**
 * A garment as the repository hands it out. `images` carries whichever of the
 * two stored images exist; `wearBudget` is null when the category default
 * applies. The row shape is Postgres's: snake_case, `numeric` as text, arrays
 * already parsed, jsonb already objects.
 */
export const GarmentFromRow = Schema.Struct({
  id: Schema.UUID,
  status: GarmentStatusSchema,
  name: Schema.String,
  category: Schema.String,
  subcategory: Schema.String,
  slots: Schema.Array(SlotSchema),
  warmth: GarmentScaleSchema,
  rainOk: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.fromKey('rain_ok'),
  ),
  formality: GarmentScaleSchema,
  wearBudget: Schema.propertySignature(Schema.NullOr(Schema.Number)).pipe(
    Schema.fromKey('wear_budget'),
  ),
  colors: Schema.Array(GarmentColorSchema),
  pattern: Schema.String,
  material: Schema.String,
  fit: Schema.String,
  sleeve: Schema.String,
  brand: Schema.String,
  seasons: Schema.Array(Schema.String),
  notes: Schema.String,
  price: NumericFromRow,
  purchasedOn: Schema.propertySignature(Schema.NullOr(LocalDateSchema)).pipe(
    Schema.fromKey('purchased_on'),
  ),
  imageChoice: Schema.propertySignature(ImageChoiceSchema).pipe(
    Schema.fromKey('image_choice'),
  ),
  processingError: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('processing_error'),
  ),
  studioRenderId: Schema.propertySignature(Schema.NullOr(Schema.UUID)).pipe(
    Schema.fromKey('studio_render_id'),
  ),
  studioRenderCompletedId: Schema.propertySignature(
    Schema.NullOr(Schema.UUID),
  ).pipe(Schema.fromKey('studio_render_completed_id')),
  retiredAt: Schema.propertySignature(
    Schema.NullOr(Schema.ValidDateFromSelf),
  ).pipe(Schema.fromKey('retired_at')),
  createdAt: Schema.propertySignature(Schema.ValidDateFromSelf).pipe(
    Schema.fromKey('created_at'),
  ),
  images: Schema.Struct({
    original: Schema.optional(GarmentImageSchema),
    studio: Schema.optional(GarmentImageSchema),
  }),
});

export type Garment = Schema.Schema.Type<typeof GarmentFromRow>;

/** The image the wardrobe shows: the chosen kind when it exists, else the other. */
export const displayImage = (garment: Garment): GarmentImage | undefined =>
  garment.imageChoice === 'studio'
    ? (garment.images.studio ?? garment.images.original)
    : (garment.images.original ?? garment.images.studio);
