import { Authorization } from '@rota/api/authorization';
import { CurrentMember } from '@rota/api/current-member';
import { Unauthorized } from '@rota/api/errors';
import { Effect, Layer, Redacted } from 'effect';
import type { Identity } from '#/shared/auth/identity.ts';

type Authorize = (headers: Headers) => Promise<Identity | null>;

/**
 * Resolves the bearer token to the member it belongs to. Better Auth's bearer
 * plugin reads the token from the Authorization header, so the same session
 * check and household gate as the web app's decide who may pass.
 */
export const apiAuthorization = (authorize: Authorize) =>
  Layer.succeed(
    Authorization,
    Authorization.of({
      bearer: (httpEffect, { credential }) =>
        Effect.gen(function* () {
          const identity = yield* Effect.promise(() =>
            authorize(
              new Headers({
                authorization: `Bearer ${Redacted.value(credential)}`,
              }),
            ),
          );
          if (identity === null) {
            return yield* new Unauthorized({
              message: 'Not signed in. Run `rota login`.',
            });
          }
          return yield* Effect.provideService(
            httpEffect,
            CurrentMember,
            identity,
          );
        }),
    }),
  );
