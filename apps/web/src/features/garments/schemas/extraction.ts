import { Schema } from 'effect';
import {
  GarmentCategorySchema,
  GarmentColorSchema,
  SlotSchema,
} from '#/shared/data/garment.ts';
import {
  garmentCategories,
  scaleMaximum,
  scaleMinimum,
  seasons,
} from '#/shared/data/garment-types.ts';

/** The longest rotation the model may suggest from material alone. */
const longestSuggestedBudget = 10;

/** What Gemini is asked to read off a garment photo. */
export const ExtractionSchema = Schema.Struct({
  name: Schema.String,
  category: GarmentCategorySchema,
  subcategory: Schema.String,
  slots: Schema.Array(SlotSchema).pipe(Schema.minItems(1)),
  warmth: Schema.Int.pipe(Schema.between(scaleMinimum, scaleMaximum)),
  rainOk: Schema.Boolean,
  formality: Schema.Int.pipe(Schema.between(scaleMinimum, scaleMaximum)),
  wearBudgetDays: Schema.Int.pipe(
    Schema.between(scaleMinimum, longestSuggestedBudget),
  ),
  colors: Schema.Array(GarmentColorSchema).pipe(Schema.minItems(1)),
  pattern: Schema.String,
  material: Schema.String,
  fit: Schema.String,
  sleeve: Schema.String,
  brand: Schema.String,
  seasons: Schema.Array(Schema.Literal(...seasons)),
  description: Schema.String,
});

export type Extraction = Schema.Schema.Type<typeof ExtractionSchema>;

const stringProperty = (description: string) => ({
  type: 'string',
  description,
});

/**
 * The JSON Schema handed to the model. Written by hand rather than derived so
 * every field carries the instruction that decides its value; the Effect
 * schema above is what the answer is checked against.
 */
export const extractionJsonSchema = {
  type: 'object',
  properties: {
    name: stringProperty(
      'A short wardrobe name: colour plus garment, at most five words, sentence case. Example: "Grey wool trousers".',
    ),
    category: {
      type: 'string',
      enum: [...garmentCategories],
      description: 'The closest category.',
    },
    subcategory: stringProperty(
      'A more specific kind, if visible: "chinos", "oxford shirt", "crew-neck jumper". Empty string if none.',
    ),
    slots: {
      type: 'array',
      items: { type: 'string', enum: ['bottom', 'under', 'top', 'over'] },
      description:
        'Every place this garment can be worn. bottom = trousers or shorts. under = beneath a top (undershirt). top = the visible torso layer. over = above a top (jumper, cardigan, overshirt; a shirt can also be an over layer above a tee).',
    },
    warmth: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      description:
        'How warm it wears: 1 = for hot days above 26 °C, 2 = warm 20–25 °C, 3 = mild 14–19 °C, 4 = cool 8–13 °C, 5 = cold below 8 °C.',
    },
    rainOk: {
      type: 'boolean',
      description:
        'False only if rain would clearly ruin or soak it (suede, delicate linen, light canvas shoes). Most garments are true.',
    },
    formality: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      description:
        '1 = sport or loungewear, 2 = casual, 3 = smart casual, 4 = business casual, 5 = formal.',
    },
    wearBudgetDays: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description:
        'How many days in a row this can be worn before washing, judged from material and how close to the skin it sits. Undershirts and tees 1–2, shirts 2, trousers and jumpers 4–5, wool outer layers up to 7.',
    },
    colors: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          name: stringProperty(
            'A plain colour name: "navy", "off-white", "olive".',
          ),
          hex: stringProperty(
            'The colour as #RRGGBB, matched to the garment, not the lighting.',
          ),
        },
        required: ['name', 'hex'],
      },
      description: 'Dominant colours first, at most three.',
    },
    pattern: stringProperty(
      '"solid", "stripes", "check", "herringbone", "print", or similar.',
    ),
    material: stringProperty(
      'Best guess of the main material: "cotton", "wool", "linen", "denim", "cotton blend".',
    ),
    fit: stringProperty(
      '"slim", "regular", "relaxed", "oversized", or empty string if unclear.',
    ),
    sleeve: stringProperty(
      '"short", "long", "sleeveless", or empty string for garments without sleeves.',
    ),
    brand: stringProperty(
      'The brand if a label or logo is legible, else empty string.',
    ),
    seasons: {
      type: 'array',
      items: { type: 'string', enum: [...seasons] },
      description: 'Seasons this garment suits.',
    },
    description: stringProperty(
      'One sentence describing the garment for a photographer who has to reproduce it exactly: kind, colour, pattern, material, distinctive details.',
    ),
  },
  required: [
    'name',
    'category',
    'subcategory',
    'slots',
    'warmth',
    'rainOk',
    'formality',
    'wearBudgetDays',
    'colors',
    'pattern',
    'material',
    'fit',
    'sleeve',
    'brand',
    'seasons',
    'description',
  ],
} as const;

export const extractionSystemPrompt = [
  'You catalogue clothes for a personal wardrobe app.',
  'You see one photo of one garment, usually laid on a bed, a floor, or held up, in ordinary indoor light.',
  'Describe the garment itself, never the surroundings.',
  'Judge colour from the fabric, correcting for the lighting.',
  'Answer only with the JSON the schema asks for.',
].join(' ');

export const extractionPrompt = 'Read this garment and fill in every field.';
