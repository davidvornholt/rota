import { signOutPath } from '@rota/api/device-login';
import { Effect } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';
import { UnexpectedResponse } from '../../shared/errors/errors.ts';
import { explainHttpFailure } from '../../shared/rota-api.ts';

/**
 * Ends one session on the server. A session the server no longer knows counts
 * as ended, so signing out twice is harmless.
 */
export const endSession = (origin: string, token: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const response = yield* http
      .execute(
        HttpClientRequest.post(`${origin}${signOutPath}`).pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.bodyJsonUnsafe({}),
        ),
      )
      .pipe(Effect.mapError(explainHttpFailure(origin)));
    yield* HttpClientResponse.matchStatus(response, {
      '2xx': () => Effect.void,
      401: () => Effect.void,
      orElse: () =>
        Effect.fail(
          new UnexpectedResponse({
            message: `${origin} did not end the session (HTTP ${response.status}).`,
          }),
        ),
    });
  });
