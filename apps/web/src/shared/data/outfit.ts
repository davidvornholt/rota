import { Schema } from 'effect';
import { SlotSchema } from './garment.ts';
import { slotOrder } from './garment-types.ts';

export const OutfitEntriesSchema = Schema.Array(
  Schema.Struct({
    garmentId: Schema.UUID,
    slot: SlotSchema,
  }),
).pipe(Schema.maxItems(slotOrder.length));
export const ForecastSnapshotSchema = Schema.Struct({
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
});
export type ForecastSnapshot = Schema.Schema.Type<
  typeof ForecastSnapshotSchema
>;
export const SavedOutfitSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  entries: OutfitEntriesSchema,
});
export type SavedOutfit = Schema.Schema.Type<typeof SavedOutfitSchema>;
export const PlanSchema = Schema.Struct({
  entries: Schema.NullOr(OutfitEntriesSchema),
  cleanTop: Schema.propertySignature(Schema.NullOr(Schema.Boolean)).pipe(
    Schema.fromKey('clean_top'),
  ),
  basedOn: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('based_on'),
  ),
  forecast: Schema.NullOr(ForecastSnapshotSchema),
});
export type DayPlan = Schema.Schema.Type<typeof PlanSchema>;
export const emptyPlan: DayPlan = {
  entries: null,
  cleanTop: null,
  basedOn: null,
  forecast: null,
};
