import { DayRefSchema, IdSchema, type Slot, slots } from '@rota/api/wardrobe';
import { Effect, Option, Schema } from 'effect';
import { Argument, Flag } from 'effect/cli';
import { InvalidInput } from '../shared/errors/errors.ts';

// Arguments, flags, and input checks that several commands share.

// Like `Flag.optional`, but a repeated flag is an error: the parser would keep
// the first value, so `--top a --top b` would silently mean the first one.
export const once = <A>(self: Flag.Flag<A>): Flag.Flag<Option.Option<A>> =>
  self.pipe(
    Flag.atMost(1),
    Flag.map((values) => Option.fromUndefinedOr(values[0])),
  );

export const optionalString = (name: string, description: string) =>
  once(Flag.String(name).pipe(Flag.withDescription(description)));

export const flag = (name: string, description: string) =>
  once(Flag.Boolean(name).pipe(Flag.withDescription(description))).pipe(
    Flag.map(Option.getOrElse(() => false)),
  );

export const fail = (message: string) =>
  Effect.fail(new InvalidInput({ message }));

/**
 * Checks a value against the schema the server will check it with, so a
 * mistake is reported here with a reason instead of as a bare rejection.
 */
export const validate =
  <T, E>(schema: Schema.Codec<T, E>, what: string) =>
  (value: E) =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError(
        (error) =>
          new InvalidInput({ message: `Invalid ${what}: ${error.message}` }),
      ),
    );

export const idArgument = (description: string) =>
  Argument.String('id').pipe(Argument.withDescription(description));

export const validId = validate(IdSchema, 'id');

/** A day a planning command acts on, `today` unless given. */
export const dayArgument = Argument.String('day').pipe(
  Argument.withDescription('today, tomorrow, or YYYY-MM-DD (default: today)'),
  Argument.withDefault('today'),
);

export const validDay = (value: string) =>
  Schema.decodeUnknownEffect(DayRefSchema)(value.trim().toLowerCase()).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          message: `${value} is not a day. Use today, tomorrow, or a date as YYYY-MM-DD.`,
        }),
    ),
  );

/** One `--<slot> <garment id>` flag per outfit slot. */
export const slotFlags = Object.fromEntries(
  slots.map((slot) => [
    slot,
    optionalString(slot, `Garment id for the ${slot} slot`),
  ]),
) as Record<Slot, Flag.Flag<Option.Option<string>>>;

/** The outfit the slot flags describe, in slot order. */
export const slotEntries = (chosen: Record<Slot, Option.Option<string>>) =>
  Effect.forEach(slots, (slot) =>
    Option.match(chosen[slot], {
      onNone: () => Effect.succeed([]),
      onSome: (garmentId) =>
        Effect.map(validId(garmentId.trim()), (id) => [
          { slot, garmentId: id },
        ]),
    }),
  ).pipe(Effect.map((entries) => entries.flat()));
