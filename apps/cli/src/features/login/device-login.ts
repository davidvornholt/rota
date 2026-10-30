import {
  deviceClientId,
  deviceCodePath,
  deviceGrantType,
  deviceTokenPath,
} from '@rota/api/device-login';
import { Clock, Duration, Effect, Schema } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';
import { LoginFailed, UnexpectedResponse } from '../../shared/errors/errors.ts';
import { explainHttpFailure } from '../../shared/rota-api.ts';

/**
 * Signs the CLI in through OAuth device authorization (RFC 8628): Rota hands
 * out a code, the member approves it in a signed-in browser, and the CLI
 * collects a session token of its own.
 */

const DeviceCodeSchema = Schema.Struct({
  deviceCode: Schema.String,
  userCode: Schema.String,
  verificationUri: Schema.String,
  verificationUriComplete: Schema.String,
  /** Seconds until the code expires. */
  expiresIn: Schema.Number,
  /** Seconds to wait between two polls. */
  interval: Schema.Number,
}).pipe(
  Schema.encodeKeys({
    deviceCode: 'device_code',
    userCode: 'user_code',
    verificationUri: 'verification_uri',
    verificationUriComplete: 'verification_uri_complete',
    expiresIn: 'expires_in',
  }),
);
export type DeviceCode = typeof DeviceCodeSchema.Type;

const CodeRequestSchema = Schema.Struct({ clientId: Schema.String }).pipe(
  Schema.encodeKeys({ clientId: 'client_id' }),
);

const TokenRequestSchema = Schema.Struct({
  grantType: Schema.String,
  deviceCode: Schema.String,
  clientId: Schema.String,
}).pipe(
  Schema.encodeKeys({
    grantType: 'grant_type',
    deviceCode: 'device_code',
    clientId: 'client_id',
  }),
);

const TokenAnswerSchema = Schema.Union([
  Schema.Struct({ accessToken: Schema.String }).pipe(
    Schema.encodeKeys({ accessToken: 'access_token' }),
  ),
  Schema.Struct({
    error: Schema.String,
    errorDescription: Schema.optional(Schema.String),
  }).pipe(Schema.encodeKeys({ errorDescription: 'error_description' })),
]);

/** Each `slow_down` answer asks for this much more time between polls (RFC 8628, 3.5). */
const slowDownStep = 5;

const post = <S extends Schema.Top>(
  origin: string,
  path: string,
  schema: S,
  body: S['Type'],
) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const request = yield* HttpClientRequest.post(`${origin}${path}`).pipe(
      HttpClientRequest.schemaBodyJson(schema)(body),
      // The bodies are plain strings, which always encode.
      Effect.orDie,
    );
    return yield* http.execute(request);
  });

/**
 * The browser opens the sign-in link, so it has to lead to the server itself.
 * An answer could otherwise point at a local file, another application, or
 * another site.
 */
const onServer = (origin: string) => (code: DeviceCode) => {
  const link = URL.parse(code.verificationUriComplete);
  return link?.origin === origin && link.username === '' && link.password === ''
    ? Effect.succeed(code)
    : Effect.fail(
        new UnexpectedResponse({
          message: `${origin} sent a sign-in link that leads somewhere else, so rota did not show or open it.`,
        }),
      );
};

export const requestDeviceCode = (origin: string) =>
  post(origin, deviceCodePath, CodeRequestSchema, {
    clientId: deviceClientId,
  }).pipe(
    Effect.mapError(explainHttpFailure(origin)),
    Effect.flatMap(
      HttpClientResponse.matchStatus({
        '2xx': (response) =>
          HttpClientResponse.schemaBodyJson(DeviceCodeSchema)(response).pipe(
            Effect.mapError(explainHttpFailure(origin)),
            Effect.flatMap(onServer(origin)),
          ),
        orElse: (response) =>
          Effect.fail(
            new UnexpectedResponse({
              message: `${origin} did not start a sign-in (HTTP ${response.status}). Try again in a minute.`,
            }),
          ),
      }),
    ),
  );

const expired = new LoginFailed({
  message:
    'The code expired before anyone approved it. Run `rota login` again.',
});

const exchange = (origin: string, deviceCode: string) =>
  post(origin, deviceTokenPath, TokenRequestSchema, {
    grantType: deviceGrantType,
    deviceCode,
    clientId: deviceClientId,
  }).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(TokenAnswerSchema)),
    Effect.mapError(explainHttpFailure(origin)),
  );

/** Polls until the member approves or denies the code, and returns the session token. */
export const awaitApproval = (origin: string, code: DeviceCode) =>
  Effect.gen(function* () {
    const deadline =
      (yield* Clock.currentTimeMillis) +
      Duration.toMillis(Duration.seconds(code.expiresIn));
    let { interval } = code;
    while ((yield* Clock.currentTimeMillis) < deadline) {
      yield* Effect.sleep(Duration.seconds(interval));
      const answer = yield* exchange(origin, code.deviceCode);
      if ('accessToken' in answer) {
        return answer.accessToken;
      }
      switch (answer.error) {
        case 'authorization_pending':
          break;
        case 'slow_down':
          interval += slowDownStep;
          break;
        case 'access_denied':
          return yield* new LoginFailed({
            message: 'The sign-in was denied in the browser.',
          });
        case 'expired_token':
          return yield* expired;
        default:
          return yield* new UnexpectedResponse({
            message: `${origin} refused the sign-in: ${answer.errorDescription ?? answer.error}.`,
          });
      }
    }
    return yield* expired;
  });
