import {
  OccasionPayloadSchema,
  PlanPayloadSchema,
  WearPayloadSchema,
} from '@rota/api/api';
import { Effect, Option } from 'effect';
import { Argument, Command } from 'effect/cli';
import { callRota } from '../shared/rota-api.ts';
import {
  dayArgument,
  fail,
  optionalString,
  slotEntries,
  slotFlags,
  validate,
  validDay,
} from './command-inputs.ts';
import { runApi } from './root.ts';

const show = Command.make('show', { day: dayArgument }, ({ day }) =>
  runApi(
    Effect.flatMap(validDay(day), (date) =>
      callRota((client) => client.days.get({ params: { date } })),
    ),
  ),
).pipe(
  Command.withDescription(
    "Show a day: weather, Rota's proposal, the plan, what was worn, the occasion, and garments in the laundry",
  ),
);

const validPlan = validate(PlanPayloadSchema, 'plan');
const validOccasion = validate(OccasionPayloadSchema, 'occasion');
const validWear = validate(WearPayloadSchema, 'outfit');

const plan = Command.make(
  'plan',
  {
    day: dayArgument,
    slots: slotFlags,
    basedOn: optionalString(
      'based-on',
      'Name of the saved outfit the plan starts from',
    ),
  },
  ({ day, slots, basedOn }) =>
    runApi(
      Effect.gen(function* () {
        const date = yield* validDay(day);
        const items = yield* slotEntries(slots);
        if (items.length === 0) {
          return yield* fail(
            'Choose at least one garment with a slot flag such as --top, or use clear-plan.',
          );
        }
        const payload = yield* validPlan({
          items,
          basedOn: Option.getOrNull(basedOn),
        });
        return yield* callRota((client) =>
          client.days.plan({ params: { date }, payload }),
        );
      }),
    ),
).pipe(
  Command.withDescription(
    'Plan the outfit for today or tomorrow, replacing any earlier plan. Prints the day.',
  ),
);

const clearPlan = Command.make('clear-plan', { day: dayArgument }, ({ day }) =>
  runApi(
    Effect.flatMap(validDay(day), (date) =>
      callRota((client) =>
        client.days.plan({
          params: { date },
          payload: { items: [], basedOn: null },
        }),
      ),
    ),
  ),
).pipe(Command.withDescription('Remove the planned outfit. Prints the day.'));

const occasion = Command.make(
  'occasion',
  {
    day: Argument.String('day').pipe(
      Argument.withDescription('today, tomorrow, or YYYY-MM-DD'),
    ),
    text: Argument.String('text').pipe(
      Argument.withDescription(
        "What the day is for, which Rota's proposal considers; an empty text clears it",
      ),
    ),
  },
  ({ day, text }) =>
    runApi(
      Effect.gen(function* () {
        const date = yield* validDay(day);
        const payload = yield* validOccasion({ text });
        return yield* callRota((client) =>
          client.days.occasion({ params: { date }, payload }),
        );
      }),
    ),
).pipe(Command.withDescription("Note the day's occasion. Prints the day."));

const wear = Command.make('wear', { slots: slotFlags }, ({ slots }) =>
  runApi(
    Effect.gen(function* () {
      const items = yield* slotEntries(slots);
      if (items.length === 0) {
        return yield* fail(
          'Name what was worn with slot flags such as --top and --bottom.',
        );
      }
      const payload = yield* validWear({ items });
      return yield* callRota((client) =>
        client.days.wear({ params: { date: 'today' }, payload }),
      );
    }),
  ),
).pipe(
  Command.withDescription(
    "Record today's outfit as worn: a complete outfit, nothing from the laundry. Prints the day.",
  ),
);

export const days = Command.make('day').pipe(
  Command.withDescription(
    'Plan today and tomorrow: see the proposal and weather, set a plan or an occasion, and record what was worn',
  ),
  Command.withSubcommands([show, plan, clearPlan, occasion, wear]),
);

export const forecast = Command.make('forecast', {}, () =>
  runApi(callRota((client) => client.days.forecast())),
).pipe(
  Command.withDescription(
    "The weather for today and the next days at the wardrobe's location",
  ),
);
