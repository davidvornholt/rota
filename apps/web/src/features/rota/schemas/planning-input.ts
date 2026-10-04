import { Schema } from 'effect';
import { OutfitEntriesSchema } from '#/shared/data/outfit.ts';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';
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
    basedOn: Schema.NullOr(Schema.String.check(Schema.isMaxLength(nameLength))),
  });
export const PlanningActionSchema = Schema.Struct({
  date: LocalDateSchema,
  change: Schema.Union([
    entryAction('suggest'),
    entryAction('plan'),
    entryAction('wear'),
    Schema.Struct({
      action: Schema.Literal('note'),
      text: Schema.String.check(Schema.isMaxLength(noteLength)),
    }),
    Schema.Struct({
      action: Schema.Literal('clean-top'),
      value: Schema.Boolean,
    }),
    Schema.Struct({
      action: Schema.Literal('care'),
      ids: Schema.Array(UuidSchema).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(maximumLaundryBatch),
      ),
      care: Schema.Literals(['laundry', 'washed', 'postpone']),
      draft: Schema.NullOr(
        Schema.Struct({
          entries: OutfitEntriesSchema,
          basedOn: Schema.NullOr(
            Schema.String.check(Schema.isMaxLength(nameLength)),
          ),
        }),
      ),
    }),
    Schema.Struct({
      action: Schema.Literal('save-outfit'),
      id: UuidSchema,
      name: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(nameLength),
      ),
      entries: OutfitEntriesSchema,
    }),
    Schema.Struct({ action: Schema.Literal('delete-outfit'), id: UuidSchema }),
  ]),
});
export type PlanningChange = Schema.Schema.Type<
  typeof PlanningActionSchema
>['change'];
export const decodePlanningDate = Schema.decodeUnknownSync(PlanningDateSchema);
export const decodePlanningAction =
  Schema.decodeUnknownSync(PlanningActionSchema);
