import { Schema } from 'effect';

import {
  GarmentCategorySchema,
  GarmentColorSchema,
  GarmentScaleSchema,
  ImageChoiceSchema,
  SlotSchema,
} from '#/shared/data/garment.ts';
import {
  longestWearBudget,
  scaleMinimum,
} from '#/shared/data/garment-types.ts';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

const shortTextLength = 120;
const nameLength = 80;
const notesLength = 2000;
const mostColors = 5;
export const renderInstructionsLength = 1000;
const highestPrice = 100_000;

const shortText = Schema.String.check(Schema.isMaxLength(shortTextLength));

/** The editable fields of a garment, as the review card and the detail page send them. */
export const GarmentEditSchema = Schema.Struct({
  name: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(nameLength),
  ),
  category: GarmentCategorySchema,
  subcategory: shortText,
  slots: Schema.Array(SlotSchema).check(Schema.isMinLength(1)),
  warmth: GarmentScaleSchema,
  rainOk: Schema.Boolean,
  formality: GarmentScaleSchema,
  wearBudget: Schema.NullOr(
    Schema.Int.check(
      Schema.isBetween({ minimum: scaleMinimum, maximum: longestWearBudget }),
    ),
  ),
  colors: Schema.Array(GarmentColorSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(mostColors),
  ),
  pattern: shortText,
  material: shortText,
  fit: shortText,
  sleeve: shortText,
  brand: shortText,
  notes: Schema.String.check(Schema.isMaxLength(notesLength)),
  price: Schema.NullOr(
    Schema.Number.check(
      Schema.isBetween({ minimum: 0, maximum: highestPrice }),
    ),
  ),
  purchasedOn: Schema.NullOr(LocalDateSchema),
});

export type GarmentEdit = Schema.Schema.Type<typeof GarmentEditSchema>;

export const GarmentIdInputSchema = Schema.Struct({ id: UuidSchema });

export const UpdateGarmentInputSchema = Schema.Struct({
  id: UuidSchema,
  edit: GarmentEditSchema,
});

export const AcceptGarmentInputSchema = Schema.Struct({
  id: UuidSchema,
  edit: GarmentEditSchema,
  imageChoice: ImageChoiceSchema,
});

export const RetryStudioInputSchema = Schema.Struct({
  id: UuidSchema,
  edit: GarmentEditSchema,
  instructions: Schema.String.check(
    Schema.isMaxLength(renderInstructionsLength),
  ),
});

export const decodeRetryStudioInput = Schema.decodeUnknownSync(
  RetryStudioInputSchema,
);

export const ImageChoiceInputSchema = Schema.Struct({
  id: UuidSchema,
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

export const decodeGarmentCareInput = Schema.decodeUnknownSync(
  Schema.Struct({
    id: UuidSchema,
    care: Schema.Literals(['laundry', 'washed']),
  }),
);
