import { Schema } from 'effect';

import { SlotSchema } from '#/shared/data/garment.ts';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

const slotCount = 6;

export const OutfitEntryInputSchema = Schema.Struct({
  garmentId: UuidSchema,
  slot: SlotSchema,
});

export const LogOutfitInputSchema = Schema.Struct({
  date: LocalDateSchema,
  entries: Schema.Array(OutfitEntryInputSchema).check(
    Schema.isMaxLength(slotCount),
  ),
  source: Schema.Literals(['override', 'backfill', 'edited']),
});

export const BackfillInputSchema = Schema.Struct({
  date: LocalDateSchema,
  copyFrom: LocalDateSchema,
});

/** Several past days written at once; a day arrives only with something on it. */
export const LogDaysInputSchema = Schema.Struct({
  days: Schema.Array(
    Schema.Struct({
      date: LocalDateSchema,
      entries: Schema.Array(OutfitEntryInputSchema).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(slotCount),
      ),
    }),
  ).check(Schema.isMinLength(1)),
});

export const decodeLogOutfitInput =
  Schema.decodeUnknownSync(LogOutfitInputSchema);
export const decodeBackfillInput =
  Schema.decodeUnknownSync(BackfillInputSchema);
export const decodeLogDaysInput = Schema.decodeUnknownSync(LogDaysInputSchema);
export type LogOutfitInput = Schema.Schema.Type<typeof LogOutfitInputSchema>;
export type LogDaysInput = Schema.Schema.Type<typeof LogDaysInputSchema>;
