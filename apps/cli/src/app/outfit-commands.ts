import { SaveOutfitPayloadSchema } from '@rota/api/api';
import { Effect, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { callRota } from '../shared/rota-api.ts';
import {
  fail,
  flag,
  idArgument,
  optionalString,
  slotEntries,
  slotFlags,
  validate,
  validId,
} from './command-inputs.ts';
import { runApi } from './root.ts';

const list = Command.make('list', {}, () =>
  runApi(callRota((client) => client.outfits.list())),
).pipe(
  Command.withDescription(
    'List saved outfits with their pieces, collections, and favourite marks',
  ),
);

const validOutfit = validate(SaveOutfitPayloadSchema, 'outfit');

const save = Command.make(
  'save',
  {
    id: optionalString(
      'id',
      'Replace the saved outfit with this id instead of saving a new one',
    ),
    name: Flag.String('name').pipe(Flag.withDescription('Outfit name')),
    slots: slotFlags,
    collections: Flag.String('collection').pipe(
      Flag.withDescription(
        'A collection to file the outfit under; repeat for more',
      ),
      Flag.atLeast(0),
    ),
    favourite: flag('favourite', 'Mark a new outfit as a favourite'),
  },
  ({ id, name, slots, collections, favourite }) =>
    runApi(
      Effect.gen(function* () {
        const outfitId = Option.isSome(id)
          ? yield* validId(id.value.trim())
          : crypto.randomUUID();
        const items = yield* slotEntries(slots);
        if (items.length === 0) {
          return yield* fail(
            'Choose the outfit with slot flags such as --top and --bottom.',
          );
        }
        const payload = yield* validOutfit({
          name: name.trim(),
          items,
          collections: collections.map((collection) => collection.trim()),
          favourite,
        });
        return yield* callRota((client) =>
          client.outfits.save({ params: { id: outfitId }, payload }),
        );
      }),
    ),
).pipe(
  Command.withDescription(
    'Save a complete outfit, or replace one with --id, which keeps its favourite mark. Prints the outfit.',
  ),
);

const markFavourite = (name: string, favourite: boolean, description: string) =>
  Command.make(name, { id: idArgument('Outfit id') }, ({ id }) =>
    runApi(
      Effect.flatMap(validId(id), (valid) =>
        callRota((client) =>
          client.outfits.favourite({
            params: { id: valid },
            payload: { favourite },
          }),
        ),
      ),
    ),
  ).pipe(Command.withDescription(description));

const remove = Command.make(
  'delete',
  { id: idArgument('Outfit id') },
  ({ id }) =>
    runApi(
      Effect.gen(function* () {
        const valid = yield* validId(id);
        yield* callRota((client) =>
          client.outfits.remove({ params: { id: valid } }),
        );
        return { deleted: valid };
      }),
    ),
).pipe(Command.withDescription('Delete a saved outfit'));

export const outfits = Command.make('outfits').pipe(
  Command.withDescription('Read and change saved outfits'),
  Command.withSubcommands([
    list,
    save,
    markFavourite('favourite', true, 'Mark a saved outfit as a favourite'),
    markFavourite('unfavourite', false, 'Remove the favourite mark'),
    remove,
  ]),
);
