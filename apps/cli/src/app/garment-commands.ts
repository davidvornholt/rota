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
  Command.withDescription('Read the garments in the wardrobe'),
  Command.withSubcommands([list, get, picture]),
);
