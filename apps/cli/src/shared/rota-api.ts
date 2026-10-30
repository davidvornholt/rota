import { RotaApi } from '@rota/api/api';
import { Authorization } from '@rota/api/authorization';
import { Context, Effect, Layer, Option, type Schema } from 'effect';
import {
  FetchHttpClient,
  type HttpClientError,
  HttpClientRequest,
} from 'effect/http';
import { HttpApiClient, HttpApiMiddleware } from 'effect/http-api';
import {
  NotSignedIn,
  ServerUnreachable,
  UnexpectedResponse,
} from './errors/errors.ts';
import { readToken } from './session-store.ts';

/**
 * HTTP for every request. A redirect comes back as its own answer instead of
 * being followed, because a request may carry the session token or a device
 * code, which only the Rota server may see.
 */
export const httpLayer = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { redirect: 'manual' }),
  ),
);

const makeClient = (origin: string, token: string) =>
  HttpApiClient.make(RotaApi, { baseUrl: origin }).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
        next(HttpClientRequest.bearerToken(request, token)),
      ),
    ),
  );

export type RotaClient = Effect.Success<ReturnType<typeof makeClient>>;

/** The signed-in API of one Rota server. */
export class Rota extends Context.Service<
  Rota,
  {
    readonly origin: string;
    readonly token: string;
    readonly client: RotaClient;
  }
>()('@rota/cli/shared/Rota') {}

export const notSignedIn = (origin: string) =>
  new NotSignedIn({
    message: `Not signed in to ${origin}. Run \`rota login\`, then try again.`,
  });

export const rotaLayer = (origin: string) =>
  Layer.effect(
    Rota,
    Effect.gen(function* () {
      const token = yield* readToken(origin);
      if (Option.isNone(token)) {
        return yield* notSignedIn(origin);
      }
      const client = yield* makeClient(origin, token.value);
      return { origin, token: token.value, client };
    }),
  );

export const unreachable = (origin: string, detail: string) =>
  new ServerUnreachable({
    message: `Could not reach ${origin}: ${detail}`,
  });

/** What any request to the API can fail with. */
type ApiFailure = Effect.Error<ReturnType<RotaClient['account']['me']>>;

/** A request that got no answer this CLI can read. */
export const explainHttpFailure =
  (origin: string) =>
  (
    error: HttpClientError.HttpClientError | Schema.SchemaError,
  ): ServerUnreachable | UnexpectedResponse => {
    if (error._tag === 'SchemaError') {
      return new UnexpectedResponse({
        message: `${origin} answered in a shape this rota does not understand (${error.message}). Update rota or check the server.`,
      });
    }
    return error.reason._tag === 'TransportError'
      ? unreachable(origin, error.message)
      : new UnexpectedResponse({
          message: `${origin} answered unexpectedly (${error.message}). Update rota or check the server.`,
        });
  };

/**
 * Turns what the API client can fail with into errors a person can act on.
 * Rota's own failures, such as `NotFound` or `Rejected`, already carry a
 * message for the user and pass through.
 */
const explain = (origin: string) => (error: ApiFailure) => {
  switch (error._tag) {
    case 'Unauthorized':
      return notSignedIn(origin);
    case 'HttpClientError':
    case 'SchemaError':
      return explainHttpFailure(origin)(error);
    default:
      return error;
  }
};

export const callRota = <A>(
  request: (client: RotaClient) => Effect.Effect<A, ApiFailure>,
) =>
  Effect.gen(function* () {
    const { client, origin } = yield* Rota;
    return yield* request(client).pipe(Effect.mapError(explain(origin)));
  });
