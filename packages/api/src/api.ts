import { Schema } from 'effect';
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { Authorization } from './authorization.ts';
import { failures } from './errors/api-errors.ts';
import {
  DaySchema,
  DayViewSchema,
  ForecastSchema,
  GarmentSchema,
  HistoryDaySchema,
  IdSchema,
  MemberSchema,
  OutfitEntriesSchema,
  OutfitSchema,
} from './wardrobe.ts';

export const outfitNameLength = 80;
export const occasionLength = 280;
export const collectionNameLength = 40;
export const collectionsPerOutfit = 12;

const dayParams = { date: DaySchema };
const idParams = { id: IdSchema };

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
    payload: Schema.Struct({
      items: OutfitEntriesSchema,
      basedOn: Schema.NullOr(
        Schema.String.check(Schema.isMaxLength(outfitNameLength)),
      ),
    }),
    success: DayViewSchema,
    error: failures,
  }),
  HttpApiEndpoint.put('occasion', '/days/:date/occasion', {
    params: dayParams,
    payload: Schema.Struct({
      text: Schema.String.check(Schema.isMaxLength(occasionLength)),
    }),
    success: DayViewSchema,
    error: failures,
  }),
  /** Records what was actually worn; only today can be recorded. */
  HttpApiEndpoint.put('wear', '/days/:date/worn', {
    params: dayParams,
    payload: Schema.Struct({ items: OutfitEntriesSchema }),
    success: DayViewSchema,
    error: failures,
  }),
  HttpApiEndpoint.get('forecast', '/forecast', {
    success: ForecastSchema,
    error: failures,
  }),
);

const CollectionNameSchema = Schema.String.check(
  Schema.isMaxLength(collectionNameLength),
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
      payload: Schema.Struct({
        name: Schema.String.check(
          Schema.isMinLength(1),
          Schema.isMaxLength(outfitNameLength),
        ),
        items: OutfitEntriesSchema,
        collections: Schema.Array(CollectionNameSchema).check(
          Schema.isMaxLength(collectionsPerOutfit),
        ),
        favourite: Schema.Boolean,
      }),
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

export const HistoryApi = HttpApiGroup.make('history').add(
  HttpApiEndpoint.get('list', '/history', {
    query: { from: DaySchema, to: DaySchema },
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
