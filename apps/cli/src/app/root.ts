import { Config, Effect, Layer, Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { FetchHttpClient } from 'effect/http';
import { rotaLayer } from '../shared/rota-api.ts';
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

/** HTTP for every request; the session, when there is one, comes from `rotaLayer`. */
export const httpLayer = FetchHttpClient.layer;

export const signedInLayer = (origin: string) =>
  rotaLayer(origin).pipe(Layer.provideMerge(httpLayer));

// Runs a command against the signed-in server and prints its result. The
// session is read lazily here, so `--help` never touches it.
export const runApi = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const data = yield* effect.pipe(Effect.provide(signedInLayer(origin)));
    yield* emit(data);
  });
