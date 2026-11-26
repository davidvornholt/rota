import { GarmentChangesSchema } from '@rota/api/api';
import { slots } from '@rota/api/wardrobe';
import { Effect, Option, Schema } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import {
  garmentPicture,
  pictureWidths,
} from '../features/pictures/pictures.ts';
import { InvalidInput } from '../shared/errors/errors.ts';
import { callRota } from '../shared/rota-api.ts';
import {
  fail,
  flag,
  idArgument,
  once,
  optionalString,
  validId,
} from './command-inputs.ts';
import { runApi } from './root.ts';

const list = Command.make(
  'list',
  {
    all: flag(
      'all',
      'Include garments that are retired or still being processed',
    ),
  },
  ({ all }) =>
    runApi(Effect.void, () =>
      callRota((client) => client.garments.list()).pipe(
        Effect.map((wardrobe) =>
          all
            ? wardrobe
            : wardrobe.filter((garment) => garment.status === 'active'),
        ),
      ),
    ),
).pipe(
  Command.withDescription(
    'List the wardrobe: active garments with their attributes, care, and wear counts',
  ),
);

const get = Command.make('get', { id: idArgument('Garment id') }, ({ id }) =>
  runApi(validId(id), (valid) =>
    callRota((client) => client.garments.get({ params: { id: valid } })),
  ),
).pipe(Command.withDescription('Show one garment'));

const setRetired = (name: string, retired: boolean, description: string) =>
  Command.make(name, { id: idArgument('Garment id') }, ({ id }) =>
    runApi(validId(id), (valid) =>
      callRota((client) =>
        client.garments.retire({
          params: { id: valid },
          payload: { retired },
        }),
      ),
    ),
  ).pipe(Command.withDescription(description));

const remove = Command.make(
  'delete',
  { id: idArgument('Garment id') },
  ({ id }) =>
    runApi(validId(id), (valid) =>
      callRota((client) =>
        client.garments.remove({ params: { id: valid } }),
      ).pipe(Effect.as({ deleted: valid })),
    ),
).pipe(
  Command.withDescription(
    'Delete a garment for good. A garment that has been worn can only be retired.',
  ),
);

const textFields = {
  name: 'Name',
  category: 'Category, such as shirt, jumper, or trousers',
  subcategory: 'Subcategory, such as knit polo',
  pattern: 'Pattern, such as solid or striped',
  material: 'Material',
  fit: 'Fit',
  sleeve: 'Sleeve',
  brand: 'Brand',
  notes: 'Notes',
} as const;
type TextField = keyof typeof textFields;

const textFlags = Object.fromEntries(
  Object.entries(textFields).map(([field, description]) => [
    field,
    optionalString(field, description),
  ]),
) as Record<TextField, Flag.Flag<Option.Option<string>>>;

/** Each flag's value as the payload field wants it; `clear` names the word that empties a nullable field. */
const number =
  (flagName: string, clear?: string) =>
  (value: string): Effect.Effect<number | null, InvalidInput> => {
    const trimmed = value.trim();
    if (clear !== undefined && trimmed.toLowerCase() === clear) {
      return Effect.succeed(null);
    }
    const parsed = Number(trimmed);
    return trimmed === '' || Number.isNaN(parsed)
      ? fail(
          `--${flagName} takes a number${clear === undefined ? '' : ` or ${clear}`}, not ${value}.`,
        )
      : Effect.succeed(parsed);
  };

const commaList = (value: string) =>
  Effect.succeed(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  );

const dayOrNone = (value: string) =>
  Effect.succeed(value.trim().toLowerCase() === 'none' ? null : value.trim());

const editFlags = {
  ...textFlags,
  slots: optionalString(
    'slots',
    `The slots it can fill, comma-separated, from ${slots.join(', ')}`,
  ),
  colors: optionalString(
    'colors',
    'Hex colours, comma-separated, the main one first, such as #3B2A22',
  ),
  warmth: optionalString('warmth', '1 (light) to 3 (warm)'),
  formality: optionalString('formality', '1 (casual) to 3 (formal)'),
  rainOk: once(
    Flag.Literals('rain-ok', ['yes', 'no']).pipe(
      Flag.withDescription('Whether it can be worn in the rain'),
    ),
  ),
  wearBudget: optionalString(
    'wear-budget',
    "Wears between washes, or default for the category's",
  ),
  price: optionalString('price', 'Price paid, or none'),
  purchasedOn: optionalString(
    'purchased-on',
    'Purchase day as YYYY-MM-DD, or none',
  ),
};

type EditField = keyof typeof editFlags;
type Parse = (value: string) => Effect.Effect<unknown, InvalidInput>;

const parsers: Record<Exclude<EditField, TextField | 'rainOk'>, Parse> = {
  slots: commaList,
  colors: commaList,
  warmth: number('warmth'),
  formality: number('formality'),
  wearBudget: number('wear-budget', 'default'),
  price: number('price', 'none'),
  purchasedOn: dayOrNone,
};

/**
 * The payload of the given flags only, so the server keeps every other field,
 * checked against the API's schema so a mistake is reported with its reason.
 */
const changesOf = (
  given: {
    readonly [Field in EditField]: Option.Option<string>;
  },
) =>
  Effect.gen(function* () {
    const changes: Record<string, unknown> = {};
    const named = Object.entries(given).filter(
      (entry): entry is [string, Option.Some<string>] =>
        Option.isSome(entry[1]),
    );
    for (const [field, value] of named) {
      if (field === 'rainOk') {
        changes[field] = value.value === 'yes';
      } else if (field in parsers) {
        changes[field] = yield* parsers[field as keyof typeof parsers](
          value.value,
        );
      } else {
        changes[field] = value.value;
      }
    }
    if (Object.keys(changes).length === 0) {
      return yield* fail('Give at least one field to change.');
    }
    return yield* Schema.decodeUnknownEffect(GarmentChangesSchema)(
      changes,
    ).pipe(
      Effect.mapError(
        (error) =>
          new InvalidInput({ message: `Invalid change: ${error.message}` }),
      ),
    );
  });

const edit = Command.make(
  'edit',
  { id: idArgument('Garment id'), ...editFlags },
  ({ id, ...given }) =>
    runApi(Effect.all([validId(id), changesOf(given)]), ([valid, changes]) =>
      callRota((client) =>
        client.garments.update({ params: { id: valid }, payload: changes }),
      ),
    ),
).pipe(
  Command.withDescription(
    'Change the given fields of a garment and keep the rest. Prints the garment.',
  ),
);

const accept = Command.make(
  'accept',
  { id: idArgument('Garment id') },
  ({ id }) =>
    runApi(validId(id), (valid) =>
      callRota((client) => client.garments.accept({ params: { id: valid } })),
    ),
).pipe(
  Command.withDescription(
    'Take a garment that waits for review into the wardrobe as it reads now; edit it first if something is wrong. Prints the garment.',
  ),
);

/** Few enough that a handful of pictures arrive together without crowding the server. */
const downloads = 4;

const picture = Command.make(
  'picture',
  {
    ids: Argument.String('id').pipe(
      Argument.withDescription('Garment ids'),
      Argument.atLeast(1),
    ),
    width: Flag.Literals('width', pictureWidths).pipe(
      Flag.withDescription('Pixel width, or the stored original'),
      Flag.withDefault('640' as const),
    ),
    kind: Flag.Literals('kind', ['picture', 'photo', 'studio']).pipe(
      Flag.withDescription(
        "picture: the one Rota shows, the studio render when there is one; photo: the member's own photo; studio: the render only",
      ),
      Flag.withDefault('picture' as const),
    ),
  },
  ({ ids, width, kind }) =>
    runApi(Effect.forEach(ids, validId), (valid) =>
      Effect.forEach(
        valid,
        (id) =>
          Effect.gen(function* () {
            const garment = yield* callRota((client) =>
              client.garments.get({ params: { id } }),
            );
            return yield* garmentPicture(garment, kind, width);
          }),
        { concurrency: downloads },
      ),
    ),
).pipe(
  Command.withDescription(
    'Save garment pictures on this machine and print their absolute paths; path is null for a garment without that picture',
  ),
);

export const garments = Command.make('garments').pipe(
  Command.withDescription(
    'Read the garments in the wardrobe, accept or edit them, and retire or delete them',
  ),
  Command.withSubcommands([
    list,
    get,
    picture,
    accept,
    edit,
    setRetired(
      'retire',
      true,
      'Take a garment out of rotation. It keeps its history and can be restored. Prints the garment.',
    ),
    setRetired(
      'restore',
      false,
      'Bring a retired garment back into rotation. Prints the garment.',
    ),
    remove,
  ]),
);
