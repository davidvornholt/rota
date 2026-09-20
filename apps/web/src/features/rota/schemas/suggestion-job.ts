import { Schema } from 'effect';
import { OutfitEntriesSchema } from '#/shared/data/outfit.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

export type SuggestionJob = {
  readonly id: string;
  readonly date: LocalDate;
  readonly status: 'running' | 'succeeded' | 'failed' | 'lost';
  readonly startedAt: number;
  readonly message: string | null;
};
export const decodeSuggestionStart = Schema.decodeUnknownSync(
  Schema.Struct({
    date: LocalDateSchema,
    entries: OutfitEntriesSchema,
    requestId: Schema.UUID,
  }),
);
export const decodeSuggestionStatus = Schema.decodeUnknownSync(
  Schema.Struct({
    date: LocalDateSchema,
    requestId: Schema.NullOr(Schema.UUID),
  }),
);
