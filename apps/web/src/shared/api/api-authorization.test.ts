import { describe, expect, it } from 'bun:test';
import { RotaApi } from '@rota/api/api';
import { Authorization } from '@rota/api/authorization';
import { Effect, Layer } from 'effect';
import { HttpClientRequest, HttpServer } from 'effect/http';
import { HttpApiMiddleware, HttpApiTest } from 'effect/http-api';
import { accountApi } from './account-api.ts';
import { apiAuthorization } from './api-authorization.ts';

const member = { id: 'personal', userId: 'u1', name: 'David', admin: true };

const askMe = (token: string) =>
  Effect.gen(function* () {
    const client = yield* HttpApiTest.groups(RotaApi, ['account']);
    return yield* client.account.me();
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        accountApi.pipe(
          Layer.provideMerge(
            apiAuthorization(async (headers) =>
              headers.get('authorization') === 'Bearer good' ? member : null,
            ),
          ),
        ),
        HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
          next(HttpClientRequest.bearerToken(request, token)),
        ),
        HttpServer.layerServices,
      ),
    ),
    Effect.scoped,
    Effect.result,
    Effect.runPromise,
  );

describe('the API authorization', () => {
  it('answers as the member the token belongs to', async () => {
    expect(await askMe('good')).toMatchObject({
      _tag: 'Success',
      success: { name: 'David', admin: true },
    });
  });

  it('turns away a token without a member', async () => {
    expect(await askMe('stale')).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'Unauthorized' },
    });
  });
});
