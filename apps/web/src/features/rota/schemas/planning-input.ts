import { Schema } from 'effect';
import { OutfitEntriesSchema } from '#/shared/data/outfit.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';

const maximumLaundryBatch = 500;
const nameLength = 80;
const noteLength = 280;
export const PlanningDateSchema = Schema.Struct({
  date: Schema.NullOr(LocalDateSchema),
});
const entryAction = <Action extends 'suggest' | 'plan' | 'wear'>(
  action: Action,
) =>
  Schema.Struct({
    action: Schema.Literal(action),
    entries: OutfitEntriesSchema,
    basedOn: Schema.NullOr(Schema.String.pipe(Schema.maxLength(nameLength))),
  });
export const PlanningActionSchema = Schema.Struct({
  date: LocalDateSchema,
  change: Schema.Union(
    entryAction('suggest'),
    entryAction('plan'),
    entryAction('wear'),
    Schema.Struct({
      action: Schema.Literal('note'),
      text: Schema.String.pipe(Schema.maxLength(noteLength)),
    }),
    Schema.Struct({
      action: Schema.Literal('clean-top'),
      value: Schema.Boolean,
    }),
    Schema.Struct({
      action: Schema.Literal('care'),
      ids: Schema.Array(Schema.UUID).pipe(
        Schema.minItems(1),
        Schema.maxItems(maximumLaundryBatch),
      ),
      care: Schema.Literal('laundry', 'washed', 'postpone'),
      draft: Schema.NullOr(
        Schema.Struct({
          entries: OutfitEntriesSchema,
          basedOn: Schema.NullOr(
            Schema.String.pipe(Schema.maxLength(nameLength)),
          ),
        }),
      ),
    }),
    Schema.Struct({
      action: Schema.Literal('save-outfit'),
      id: Schema.UUID,
      name: Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(nameLength),
      ),
      entries: OutfitEntriesSchema,
    }),
    Schema.Struct({ action: Schema.Literal('delete-outfit'), id: Schema.UUID }),
  ),
});
export type PlanningChange = Schema.Schema.Type<
  typeof PlanningActionSchema
>['change'];
export const decodePlanningDate = Schema.decodeUnknownSync(PlanningDateSchema);
export const decodePlanningAction =
  Schema.decodeUnknownSync(PlanningActionSchema);
