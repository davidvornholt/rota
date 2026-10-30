import { RotaApi } from '@rota/api/api';
import { createFileRoute } from '@tanstack/react-router';
import { Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/http';
import { HttpApiBuilder } from 'effect/http-api';
import { garmentsApi } from '#/features/garments/api/garments-api.ts';
import { historyApi } from '#/features/history/api/history-api.ts';
import { daysApi } from '#/features/rota/api/days-api.ts';
import { outfitsApi } from '#/features/rota/api/outfits-api.ts';
import { accountApi } from '#/shared/api/account-api.ts';
import { apiAuthorization } from '#/shared/api/api-authorization.ts';
import { applyPrivateResponseHeaders } from '#/shared/auth/private-response.ts';
import { authorizedIdentity } from '#/shared/auth/session.ts';

type Handler = (request: Request) => Promise<Response>;

let built: Handler | undefined;

// Built on the first request, like the feature runtimes, so importing the
// route runs nothing.
const cliHandler = (): Handler => {
  if (built === undefined) {
    const groups = Layer.mergeAll(
      accountApi,
      garmentsApi,
      daysApi,
      outfitsApi,
      historyApi,
    ).pipe(Layer.provide(apiAuthorization(authorizedIdentity)));
    const { handler } = HttpRouter.toWebHandler(
      HttpApiBuilder.layer(RotaApi).pipe(
        Layer.provide(groups),
        Layer.provide(HttpServer.layerServices),
      ),
      { disableLogger: true },
    );
    built = (request) => handler(request);
  }
  return built;
};

/** The JSON API the `rota` CLI calls with the bearer token from `rota login`. */
const serveCli = async ({ request }: { readonly request: Request }) => {
  const response = await cliHandler()(request);
  applyPrivateResponseHeaders(response.headers);
  return response;
};

export const Route = createFileRoute('/api/cli/$')({
  server: {
    handlers: { GET: serveCli, PUT: serveCli, DELETE: serveCli },
  },
});
