import { historyDefaultDays, historyMaxDays } from '@rota/api/api';
import { DaySchema } from '@rota/api/wardrobe';
import { Effect, Option } from 'effect';
import { Command } from 'effect/cli';
import { callRota } from '../shared/rota-api.ts';
import { fail, optionalString, validate } from './command-inputs.ts';
import { runApi } from './root.ts';

const millisecondsPerDay = 86_400_000;

const validHistoryDay = validate(DaySchema, 'day');

/** Whole days from one calendar day to another; negative when `to` is earlier. */
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      millisecondsPerDay,
  );

// The server fills in a missing end: today where the wardrobe stands, which
// may not be today on this machine. Only a range with both ends can be
// checked here.
const validRange = (from: Option.Option<string>, to: Option.Option<string>) =>
  Effect.gen(function* () {
    const first = yield* Effect.transposeOption(
      Option.map(from, validHistoryDay),
    );
    const last = yield* Effect.transposeOption(Option.map(to, validHistoryDay));
    if (Option.isSome(first) && Option.isSome(last)) {
      const span = daysBetween(first.value, last.value);
      if (span < 0) {
        return yield* fail(
          `--from ${first.value} is after --to ${last.value}. Give the earlier day as --from.`,
        );
      }
      if (span >= historyMaxDays) {
        return yield* fail(
          `${first.value} to ${last.value} is ${span + 1} days, but one request covers at most ${historyMaxDays}. Ask for a shorter range.`,
        );
      }
    }
    return {
      from: Option.getOrUndefined(first),
      to: Option.getOrUndefined(last),
    };
  });

export const history = Command.make(
  'history',
  {
    from: optionalString(
      'from',
      `First day, YYYY-MM-DD (default: ${historyDefaultDays - 1} days before --to)`,
    ),
    to: optionalString(
      'to',
      'Last day, YYYY-MM-DD (default: today where the wardrobe is)',
    ),
  },
  ({ from, to }) =>
    runApi(validRange(from, to), (query) =>
      callRota((client) => client.history.list({ query })),
    ),
).pipe(
  Command.withDescription(
    `What was worn and which occasions were noted, day by day, oldest first, at most ${historyMaxDays} days at a time`,
  ),
);
