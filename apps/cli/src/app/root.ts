import { Config, Effect, Layer, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { httpLayer, rotaLayer } from '../shared/rota-api.ts';
import { defaultServer, serverOrigin } from '../shared/server.ts';
import { emit } from './output.ts';

const server = Flag.String('server').pipe(
  Flag.withDescription(
    `The Rota server. Defaults to $ROTA_SERVER, else ${defaultServer}.`,
  ),
  Flag.withFallbackConfig(Config.NonEmptyString('ROTA_SERVER')),
  Flag.optional,
);

export const root = Command.make('rota').pipe(
  Command.withSharedFlags({ server }),
  Command.withDescription(
    'Read and plan your Rota wardrobe: garments and their pictures, today and tomorrow, saved outfits, and what you wore. Prints JSON.',
  ),
);

/** The origin of the server the command talks to. */
export const currentOrigin = Effect.flatMap(root, ({ server: chosen }) =>
  serverOrigin(Option.getOrElse(chosen, () => defaultServer)),
);

export const signedInLayer = (origin: string) =>
  rotaLayer(origin).pipe(Layer.provideMerge(httpLayer));

// Checks a command's input, then sends its request to the signed-in server
// and prints the result. The session is read only after the input passes, so
// `--help` never touches it and a mistake in the input is reported as one even
// when nobody is signed in.
export const runApi = <I, A, E1, E2, R1, R2>(
  input: Effect.Effect<I, E1, R1>,
  request: (input: I) => Effect.Effect<A, E2, R2>,
) =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const valid = yield* input;
    const data = yield* request(valid).pipe(
      Effect.provide(signedInLayer(origin)),
    );
    yield* emit(data);
  });
