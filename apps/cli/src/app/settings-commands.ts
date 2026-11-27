import { SettingsChangesSchema } from '@rota/api/api';
import { Effect, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { callRota } from '../shared/rota-api.ts';
import { fail, number, optionalString, validate } from './command-inputs.ts';
import { runApi } from './root.ts';

const show = Command.make('show', {}, () =>
  runApi(Effect.void, () => callRota((client) => client.settings.get())),
).pipe(Command.withDescription('Show the settings'));

const setFlags = {
  laundryDays: optionalString(
    'laundry-days',
    'Days a garment is away after its last wear before washing',
  ),
  cooldownDays: optionalString(
    'cooldown-days',
    'Days before a worn outfit is proposed again',
  ),
  proposalHour: optionalString(
    'proposal-hour',
    "The hour, 0 to 23, Rota proposes the day's outfit",
  ),
  cleanTopFrom: optionalString(
    'clean-top-from',
    'A clean top every other day from YYYY-MM-DD, or none to choose each day',
  ),
  styleNote: optionalString(
    'style-note',
    'Standing style preferences every proposal follows, such as "Smart casual most days". An empty text clears it.',
  ),
  wearBudgets: Flag.String('wear-budget').pipe(
    Flag.withDescription(
      "A category's wears between washes as category=number, or category=default for Rota's. Repeat it for more categories.",
    ),
    Flag.atLeast(0),
  ),
};

/** `jumper=6` as `['jumper', 6]`, and `jumper=default` as `['jumper', null]`. */
const wearBudget = (value: string) => {
  const [category = '', budget, ...rest] = value.split('=');
  return budget === undefined || rest.length > 0 || category.trim() === ''
    ? fail(
        `--wear-budget takes category=number or category=default, not ${value}.`,
      )
    : Effect.map(
        number('wear-budget', 'default')(budget),
        (parsed) => [category.trim(), parsed] as const,
      );
};

const optionalNumber = (flagName: string, value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => Effect.succeed(undefined),
    onSome: number(flagName),
  });

/** The payload of the given flags only, so the server keeps every other setting. */
const changesOf = (given: {
  readonly laundryDays: Option.Option<string>;
  readonly cooldownDays: Option.Option<string>;
  readonly proposalHour: Option.Option<string>;
  readonly cleanTopFrom: Option.Option<string>;
  readonly styleNote: Option.Option<string>;
  readonly wearBudgets: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const changes = {
      laundryDays: yield* optionalNumber('laundry-days', given.laundryDays),
      cooldownDays: yield* optionalNumber('cooldown-days', given.cooldownDays),
      proposalHour: yield* optionalNumber('proposal-hour', given.proposalHour),
      cleanTopFrom: Option.getOrUndefined(
        Option.map(given.cleanTopFrom, (day) =>
          day.trim().toLowerCase() === 'none' ? null : day.trim(),
        ),
      ),
      styleNote: Option.getOrUndefined(given.styleNote),
      wearBudgets:
        given.wearBudgets.length === 0
          ? undefined
          : Object.fromEntries(
              yield* Effect.forEach(given.wearBudgets, wearBudget),
            ),
    };
    const named = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(named).length === 0) {
      return yield* fail('Give at least one setting to change.');
    }
    return yield* validate(SettingsChangesSchema, 'change')(named);
  });

const set = Command.make('set', setFlags, (given) =>
  runApi(changesOf(given), (changes) =>
    callRota((client) => client.settings.update({ payload: changes })),
  ),
).pipe(
  Command.withDescription(
    'Change the given settings and keep the rest. Prints the settings.',
  ),
);

export const settings = Command.make('settings').pipe(
  Command.withDescription(
    'Read and change the settings: laundry and rotation timing, wears between washes by category, and the style note. The place is chosen in the web app.',
  ),
  Command.withSubcommands([show, set]),
);
