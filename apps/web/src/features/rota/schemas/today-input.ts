import { Schema } from 'effect';

import { SlotSchema } from '#/shared/data/garment.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

const occasionLength = 280;
const slotCount = 4;

export const ProposalIdInputSchema = Schema.Struct({ id: Schema.UUID });

export const RerollInputSchema = Schema.Struct({
  id: Schema.UUID,
  scope: Schema.Literal('boundary', 'all'),
});

export const OccasionInputSchema = Schema.Struct({
  occasion: Schema.String.pipe(Schema.maxLength(occasionLength)),
});

export const OutfitEntryInputSchema = Schema.Struct({
  garmentId: Schema.UUID,
  slot: SlotSchema,
});

export const LogOutfitInputSchema = Schema.Struct({
  date: LocalDateSchema,
  entries: Schema.Array(OutfitEntryInputSchema).pipe(
    Schema.maxItems(slotCount),
  ),
  source: Schema.Literal('override', 'backfill', 'edited'),
});

export const BackfillInputSchema = Schema.Struct({
  date: LocalDateSchema,
  copyFrom: LocalDateSchema,
});

export const AlternativesInputSchema = Schema.Struct({
  slot: SlotSchema,
  currentIds: Schema.Array(Schema.UUID),
});

export const decodeProposalId = Schema.decodeUnknownSync(ProposalIdInputSchema);
export const decodeRerollInput = Schema.decodeUnknownSync(RerollInputSchema);
export const decodeOccasionInput =
  Schema.decodeUnknownSync(OccasionInputSchema);
export const decodeLogOutfitInput =
  Schema.decodeUnknownSync(LogOutfitInputSchema);
export const decodeBackfillInput =
  Schema.decodeUnknownSync(BackfillInputSchema);
export const decodeAlternativesInput = Schema.decodeUnknownSync(
  AlternativesInputSchema,
);

export type LogOutfitInput = Schema.Schema.Type<typeof LogOutfitInputSchema>;
