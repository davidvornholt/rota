import { DaySchema } from '@rota/api/wardrobe';
import { Clock, Effect, Option } from 'effect';
import { Command } from 'effect/cli';
import { callRota } from '../shared/rota-api.ts';
import { optionalString, validate } from './command-inputs.ts';
import { runApi } from './root.ts';

/** The default range: the last 30 days, today included. */
const defaultSpan = 30;
const dayMs = 86_400_000;

const validHistoryDay = validate(DaySchema, 'day');

/** This machine's calendar day, `days` before today. */
const localDay = (nowMs: number, days: number) => {
  const date = new Date(nowMs - days * dayMs);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const history = Command.make(
  'history',
  {
    from: optionalString(
      'from',
      'First day, YYYY-MM-DD (default: 29 days before --to)',
    ),
    to: optionalString('to', 'Last day, YYYY-MM-DD (default: today)'),
  },
  ({ from, to }) =>
    runApi(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const last = yield* validHistoryDay(
          Option.getOrElse(to, () => localDay(now, 0)),
        );
        const first = yield* validHistoryDay(
          Option.getOrElse(from, () =>
            localDay(Date.parse(`${last}T12:00:00`), defaultSpan - 1),
          ),
        );
        return yield* callRota((client) =>
          client.history.list({ query: { from: first, to: last } }),
        );
      }),
    ),
).pipe(
  Command.withDescription(
    'What was worn and which occasions were noted, day by day, oldest first, at most a year at a time',
  ),
);
