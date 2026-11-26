import { Schema } from 'effect';
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { Authorization } from './authorization.ts';
import { failures } from './errors/api-errors.ts';
import {
  DayRefSchema,
  DaySchema,
  DayViewSchema,
  ForecastSchema,
  GarmentSchema,
  HistoryDaySchema,
  IdSchema,
  MemberSchema,
  OutfitEntriesSchema,
  OutfitSchema,
  SlotSchema,
} from './wardrobe.ts';

export const outfitNameLength = 80;
export const occasionLength = 280;
export const collectionNameLength = 40;
export const collectionsPerOutfit = 12;

const dayParams = { date: DayRefSchema };
const idParams = { id: IdSchema };

const CollectionNameSchema = Schema.String.check(
  Schema.isMaxLength(collectionNameLength),
);

// The request bodies are exported so a client can check its input before
// sending it; the server answers a body that fails them with an empty 400.

export const PlanPayloadSchema = Schema.Struct({
  items: OutfitEntriesSchema,
  basedOn: Schema.NullOr(
    Schema.String.check(Schema.isMaxLength(outfitNameLength)),
  ),
});

export const OccasionPayloadSchema = Schema.Struct({
  text: Schema.String.check(Schema.isMaxLength(occasionLength)),
});

/**
 * The fields of a garment a client changes; a field left out keeps its value.
 * `wearBudget: null` returns to the category's default and `price` or
 * `purchasedOn: null` clears it. The server checks the result against the
 * same rules as the web app's form, such as a known category and 1 to 3 for
 * warmth, and rejects it with the reason.
 */
export const GarmentChangesSchema = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  category: Schema.optionalKey(Schema.String),
  subcategory: Schema.optionalKey(Schema.String),
  slots: Schema.optionalKey(Schema.Array(SlotSchema)),
  warmth: Schema.optionalKey(Schema.Number),
  formality: Schema.optionalKey(Schema.Number),
  rainOk: Schema.optionalKey(Schema.Boolean),
  wearBudget: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  /** Hex colours such as `#3B2A22`, the main one first. */
  colors: Schema.optionalKey(Schema.Array(Schema.String)),
  pattern: Schema.optionalKey(Schema.String),
  material: Schema.optionalKey(Schema.String),
  fit: Schema.optionalKey(Schema.String),
  sleeve: Schema.optionalKey(Schema.String),
  brand: Schema.optionalKey(Schema.String),
  notes: Schema.optionalKey(Schema.String),
  price: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  purchasedOn: Schema.optionalKey(Schema.NullOr(DaySchema)),
});
export type GarmentChanges = typeof GarmentChangesSchema.Type;

export const WearPayloadSchema = Schema.Struct({ items: OutfitEntriesSchema });

export const SaveOutfitPayloadSchema = Schema.Struct({
  name: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(outfitNameLength),
  ),
  items: OutfitEntriesSchema,
  collections: Schema.Array(CollectionNameSchema).check(
    Schema.isMaxLength(collectionsPerOutfit),
  ),
  favourite: Schema.Boolean,
});

export const AccountApi = HttpApiGroup.make('account').add(
  HttpApiEndpoint.get('me', '/me', { success: MemberSchema, error: failures }),
);

export const GarmentsApi = HttpApiGroup.make('garments')
  .add(
    HttpApiEndpoint.get('list', '/', {
      success: Schema.Array(GarmentSchema),
      error: failures,
    }),
    HttpApiEndpoint.get('get', '/:id', {
      params: idParams,
      success: GarmentSchema,
      error: failures,
    }),
    HttpApiEndpoint.put('update', '/:id', {
      params: idParams,
      payload: GarmentChangesSchema,
      success: GarmentSchema,
      error: failures,
    }),
    /** Takes a garment that waits for review into the wardrobe as it reads now. */
    HttpApiEndpoint.put('accept', '/:id/accepted', {
      params: idParams,
      success: GarmentSchema,
      error: failures,
    }),
    /** Moves a garment out of rotation or back. A garment still being added is accepted or deleted instead. */
    HttpApiEndpoint.put('retire', '/:id/retired', {
      params: idParams,
      payload: Schema.Struct({ retired: Schema.Boolean }),
      success: GarmentSchema,
      error: failures,
    }),
    /** A garment with wear history can only be retired, so the history keeps it. */
    HttpApiEndpoint.delete('remove', '/:id', {
      params: idParams,
      error: failures,
    }),
  )
  .prefix('/garments');

/** Planning works on today and tomorrow, like the app; other days are rejected. */
export const DaysApi = HttpApiGroup.make('days').add(
  HttpApiEndpoint.get('get', '/days/:date', {
    params: dayParams,
    success: DayViewSchema,
    error: failures,
  }),
  HttpApiEndpoint.put('plan', '/days/:date/plan', {
    params: dayParams,
    payload: PlanPayloadSchema,
    success: DayViewSchema,
    error: failures,
  }),
  HttpApiEndpoint.put('occasion', '/days/:date/occasion', {
    params: dayParams,
    payload: OccasionPayloadSchema,
    success: DayViewSchema,
    error: failures,
  }),
  /** Records what was actually worn; only today can be recorded. */
  HttpApiEndpoint.put('wear', '/days/:date/worn', {
    params: dayParams,
    payload: WearPayloadSchema,
    success: DayViewSchema,
    error: failures,
  }),
  HttpApiEndpoint.get('forecast', '/forecast', {
    success: ForecastSchema,
    error: failures,
  }),
);

export const OutfitsApi = HttpApiGroup.make('outfits')
  .add(
    HttpApiEndpoint.get('list', '/', {
      success: Schema.Array(OutfitSchema),
      error: failures,
    }),
    /** Creates the outfit with this id, or replaces it. A replaced outfit keeps its favourite mark. */
    HttpApiEndpoint.put('save', '/:id', {
      params: idParams,
      payload: SaveOutfitPayloadSchema,
      success: OutfitSchema,
      error: failures,
    }),
    HttpApiEndpoint.put('favourite', '/:id/favourite', {
      params: idParams,
      payload: Schema.Struct({ favourite: Schema.Boolean }),
      success: OutfitSchema,
      error: failures,
    }),
    HttpApiEndpoint.delete('remove', '/:id', {
      params: idParams,
      error: failures,
    }),
  )
  .prefix('/outfits');

/** How many days, both ends included, a history request without `from` covers. */
export const historyDefaultDays = 30;
/** The most days, both ends included, one history request may cover. */
export const historyMaxDays = 366;

/**
 * `to` defaults to today where the wardrobe stands, and `from` to the day
 * that makes the range `historyDefaultDays` long.
 */
export const HistoryApi = HttpApiGroup.make('history').add(
  HttpApiEndpoint.get('list', '/history', {
    query: {
      from: Schema.optional(DaySchema),
      to: Schema.optional(DaySchema),
    },
    success: Schema.Array(HistoryDaySchema),
    error: failures,
  }),
);

export const apiPrefix = '/api/cli';

export class RotaApi extends HttpApi.make('rota')
  .add(AccountApi)
  .add(GarmentsApi)
  .add(DaysApi)
  .add(OutfitsApi)
  .add(HistoryApi)
  .middleware(Authorization)
  .prefix(apiPrefix) {}
