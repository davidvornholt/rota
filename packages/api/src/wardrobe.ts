import { Schema } from 'effect';

/**
 * The wardrobe as the API shows it to a client such as the CLI. These shapes
 * are the wire contract: the web app maps its own views onto them, so a field
 * added here is a promise to every client.
 */

export const slots = [
  'bottom',
  'under',
  'top',
  'dress',
  'over',
  'scarf',
  'hat',
  'shoes',
  'bag',
] as const;
export const SlotSchema = Schema.Literals(slots);
export type Slot = typeof SlotSchema.Type;

const isCalendarDay = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/** A calendar day where the wardrobe stands, as `YYYY-MM-DD`. */
export const DaySchema = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
  Schema.makeFilter(
    (value: string) => isCalendarDay(value) || 'expected a calendar day',
  ),
);

/** A day as a client names it. The server resolves `today` and `tomorrow` in the wardrobe's time zone. */
export const DayRefSchema = Schema.Union([
  Schema.Literals(['today', 'tomorrow']),
  DaySchema,
]);
export type DayRef = typeof DayRefSchema.Type;

export const IdSchema = Schema.String.check(Schema.isGUID());

/** A stored picture. `url` is a path on the Rota server that accepts `?w=320`, `640`, or `1280`. */
export const PictureSchema = Schema.Struct({
  url: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
});

export const GarmentSchema = Schema.Struct({
  id: IdSchema,
  name: Schema.String,
  status: Schema.Literals(['processing', 'review', 'active', 'retired']),
  category: Schema.String,
  subcategory: Schema.String,
  slots: Schema.Array(SlotSchema),
  colors: Schema.Array(Schema.String),
  pattern: Schema.String,
  material: Schema.String,
  fit: Schema.String,
  sleeve: Schema.String,
  brand: Schema.String,
  notes: Schema.String,
  /** 1 (light) to 3 (warm). */
  warmth: Schema.Number,
  /** 1 (casual) to 3 (formal). */
  formality: Schema.Number,
  rainOk: Schema.Boolean,
  wears: Schema.Number,
  lastWornOn: Schema.NullOr(DaySchema),
  /** How many wears the garment takes between washes. */
  wearBudget: Schema.Number,
  wearsSinceWash: Schema.Number,
  inLaundry: Schema.Boolean,
  /** The day a garment in the laundry is clean again. */
  readyOn: Schema.NullOr(DaySchema),
  price: Schema.NullOr(Schema.Number),
  purchasedOn: Schema.NullOr(DaySchema),
  costPerWear: Schema.NullOr(Schema.Number),
  /** The picture Rota shows: the studio render when there is one, otherwise the photo. */
  picture: Schema.NullOr(PictureSchema),
  photo: Schema.NullOr(PictureSchema),
  studio: Schema.NullOr(PictureSchema),
});
export type Garment = typeof GarmentSchema.Type;

/** One piece of an outfit as a client chooses it. */
export const OutfitEntrySchema = Schema.Struct({
  slot: SlotSchema,
  garmentId: IdSchema,
});

export const OutfitEntriesSchema = Schema.Array(OutfitEntrySchema).check(
  Schema.isMaxLength(slots.length),
);

/** One piece of an outfit as the API reports it. */
export const OutfitItemSchema = Schema.Struct({
  slot: SlotSchema,
  garmentId: IdSchema,
  name: Schema.String,
});
export type OutfitItem = typeof OutfitItemSchema.Type;

export const WeatherSchema = Schema.Struct({
  date: DaySchema,
  location: Schema.String,
  /** The hours the forecast covers, such as `7:00–19:00 local time`. */
  hours: Schema.String,
  conditions: Schema.String,
  highC: Schema.Number,
  lowC: Schema.Number,
  precipitationProbability: Schema.Number,
  precipitationMm: Schema.Number,
  windKmh: Schema.Number,
});
export type Weather = typeof WeatherSchema.Type;

export const ProposalSchema = Schema.Struct({
  status: Schema.String,
  headline: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      slot: SlotSchema,
      garmentId: IdSchema,
      name: Schema.String,
      reason: Schema.String,
    }),
  ),
  forecastStale: Schema.Boolean,
});

export const PlanSchema = Schema.Struct({
  items: Schema.Array(OutfitItemSchema),
  basedOn: Schema.NullOr(Schema.String),
});

/** Today or tomorrow, as the planner sees it. */
export const DayViewSchema = Schema.Struct({
  date: DaySchema,
  today: DaySchema,
  weather: Schema.NullOr(WeatherSchema),
  forecastStale: Schema.Boolean,
  /** The note for the day, such as an occasion Rota's proposal considers. */
  occasion: Schema.NullOr(Schema.String),
  proposal: Schema.NullOr(ProposalSchema),
  worn: Schema.NullOr(Schema.Array(OutfitItemSchema)),
  plan: Schema.NullOr(PlanSchema),
  /** Active garments that are in the laundry on this day, so a plan should leave them out. */
  laundry: Schema.Array(
    Schema.Struct({
      garmentId: IdSchema,
      name: Schema.String,
      readyOn: Schema.NullOr(DaySchema),
    }),
  ),
  problem: Schema.NullOr(Schema.String),
  warnings: Schema.Array(Schema.String),
});
export type DayView = typeof DayViewSchema.Type;

export const OutfitSchema = Schema.Struct({
  id: IdSchema,
  name: Schema.String,
  items: Schema.Array(OutfitItemSchema),
  collections: Schema.Array(Schema.String),
  favourite: Schema.Boolean,
});
export type Outfit = typeof OutfitSchema.Type;

export const HistoryDaySchema = Schema.Struct({
  date: DaySchema,
  worn: Schema.Array(OutfitItemSchema),
  occasion: Schema.NullOr(Schema.String),
  weather: Schema.NullOr(WeatherSchema),
});
export type HistoryDay = typeof HistoryDaySchema.Type;

export const ForecastSchema = Schema.Struct({
  today: DaySchema,
  stale: Schema.Boolean,
  days: Schema.Array(WeatherSchema),
});
export type Forecast = typeof ForecastSchema.Type;

export const MemberSchema = Schema.Struct({
  name: Schema.String,
  admin: Schema.Boolean,
});
