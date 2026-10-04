import { Schema } from 'effect';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';
import { SlotSchema } from './garment.ts';
import { slotOrder } from './garment-types.ts';

export const OutfitEntriesSchema = Schema.Array(
  Schema.Struct({
    garmentId: UuidSchema,
    slot: SlotSchema,
  }),
).check(Schema.isMaxLength(slotOrder.length));
export const ForecastSnapshotSchema = Schema.Struct({
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
});
export type ForecastSnapshot = Schema.Schema.Type<
  typeof ForecastSnapshotSchema
>;
export const SavedOutfitSchema = Schema.Struct({
  id: UuidSchema,
  name: Schema.String,
  entries: OutfitEntriesSchema,
});
export type SavedOutfit = Schema.Schema.Type<typeof SavedOutfitSchema>;
export const PlanSchema = Schema.Struct({
  entries: Schema.NullOr(OutfitEntriesSchema),
  cleanTop: Schema.NullOr(Schema.Boolean),
  basedOn: Schema.NullOr(Schema.String),
  forecast: Schema.NullOr(ForecastSnapshotSchema),
}).pipe(
  Schema.encodeKeys({
    cleanTop: 'clean_top',
    basedOn: 'based_on',
  }),
);
export type DayPlan = Schema.Schema.Type<typeof PlanSchema>;
export const emptyPlan: DayPlan = {
  entries: null,
  cleanTop: null,
  basedOn: null,
  forecast: null,
};
