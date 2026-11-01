import { Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import {
  garmentPicture,
  pictureWidths,
} from '../features/pictures/pictures.ts';
import { callRota } from '../shared/rota-api.ts';
import { flag, idArgument, validId } from './command-inputs.ts';
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
    runApi(
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
  runApi(
    Effect.flatMap(validId(id), (valid) =>
      callRota((client) => client.garments.get({ params: { id: valid } })),
    ),
  ),
).pipe(Command.withDescription('Show one garment'));

const setRetired = (name: string, retired: boolean, description: string) =>
  Command.make(name, { id: idArgument('Garment id') }, ({ id }) =>
    runApi(
      Effect.flatMap(validId(id), (valid) =>
        callRota((client) =>
          client.garments.retire({
            params: { id: valid },
            payload: { retired },
          }),
        ),
      ),
    ),
  ).pipe(Command.withDescription(description));

const remove = Command.make(
  'delete',
  { id: idArgument('Garment id') },
  ({ id }) =>
    runApi(
      Effect.gen(function* () {
        const valid = yield* validId(id);
        yield* callRota((client) =>
          client.garments.remove({ params: { id: valid } }),
        );
        return { deleted: valid };
      }),
    ),
).pipe(
  Command.withDescription(
    'Delete a garment for good. A garment that has been worn can only be retired.',
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
    runApi(
      Effect.forEach(
        ids,
        (id) =>
          Effect.gen(function* () {
            const valid = yield* validId(id);
            const garment = yield* callRota((client) =>
              client.garments.get({ params: { id: valid } }),
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
    'Read the garments in the wardrobe and retire or delete them',
  ),
  Command.withSubcommands([
    list,
    get,
    picture,
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
