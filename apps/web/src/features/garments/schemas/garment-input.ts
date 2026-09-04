import { Schema } from 'effect';

import {
  GarmentCategorySchema,
  GarmentColorSchema,
  ImageChoiceSchema,
  SlotSchema,
} from '#/shared/data/garment.ts';
import {
  longestWearBudget,
  scaleMaximum,
  scaleMinimum,
} from '#/shared/data/garment-types.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

const shortTextLength = 120;
const nameLength = 80;
const notesLength = 2000;
const mostColors = 5;
const highestPrice = 100_000;

const shortText = Schema.String.pipe(Schema.maxLength(shortTextLength));

/** The editable fields of a garment, as the review card and the detail page send them. */
export const GarmentEditSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(nameLength)),
  category: GarmentCategorySchema,
  subcategory: shortText,
  slots: Schema.Array(SlotSchema).pipe(Schema.minItems(1)),
  warmth: Schema.Int.pipe(Schema.between(scaleMinimum, scaleMaximum)),
  rainOk: Schema.Boolean,
  formality: Schema.Int.pipe(Schema.between(scaleMinimum, scaleMaximum)),
  wearBudget: Schema.NullOr(
    Schema.Int.pipe(Schema.between(scaleMinimum, longestWearBudget)),
  ),
  colors: Schema.Array(GarmentColorSchema).pipe(Schema.maxItems(mostColors)),
  pattern: shortText,
  material: shortText,
  fit: shortText,
  sleeve: shortText,
  brand: shortText,
  seasons: Schema.Array(Schema.String),
  notes: Schema.String.pipe(Schema.maxLength(notesLength)),
  price: Schema.NullOr(Schema.Number.pipe(Schema.between(0, highestPrice))),
  purchasedOn: Schema.NullOr(LocalDateSchema),
});

export type GarmentEdit = Schema.Schema.Type<typeof GarmentEditSchema>;

export const GarmentIdInputSchema = Schema.Struct({ id: Schema.UUID });

export const UpdateGarmentInputSchema = Schema.Struct({
  id: Schema.UUID,
  edit: GarmentEditSchema,
});

export const AcceptGarmentInputSchema = Schema.Struct({
  id: Schema.UUID,
  edit: GarmentEditSchema,
  imageChoice: ImageChoiceSchema,
});

export const ImageChoiceInputSchema = Schema.Struct({
  id: Schema.UUID,
  imageChoice: ImageChoiceSchema,
});

export const decodeGarmentId = Schema.decodeUnknownSync(GarmentIdInputSchema);
export const decodeUpdateGarmentInput = Schema.decodeUnknownSync(
  UpdateGarmentInputSchema,
);
export const decodeAcceptGarmentInput = Schema.decodeUnknownSync(
  AcceptGarmentInputSchema,
);
export const decodeImageChoiceInput = Schema.decodeUnknownSync(
  ImageChoiceInputSchema,
);
