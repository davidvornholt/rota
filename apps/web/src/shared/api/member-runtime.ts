import { CurrentMember } from '@rota/api/current-member';
import {
  type Failure,
  NotFound,
  Rejected,
  ServerError,
} from '@rota/api/errors';
import { Effect, Schema } from 'effect';
import { asIdentity } from '#/shared/auth/identity.ts';
import { taggedSafeFailure } from '#/shared/auth/private-response.ts';

const notFound = 404;

/**
 * The failure a client may see, by the same rule as the web app: a tagged
 * error that declares a 4xx status has a message meant for the member, and
 * anything else stays in the server's log.
 */
export const apiFailure = (error: unknown): Failure => {
  if (Schema.isSchemaError(error)) {
    return new Rejected({ message: 'Invalid request.' });
  }
  const safe = taggedSafeFailure(error);
  if (safe === undefined) {
    return new ServerError({ message: 'The request could not be completed.' });
  }
  return safe.status === notFound
    ? new NotFound({ message: safe.message })
    : new Rejected({ message: safe.message });
};

/**
 * Runs feature work as the member the request is authorized for. A feature
 * runtime picks the member's wardrobe from the request identity, so the
 * identity is set here, around the call, rather than inherited from whatever
 * fiber the HTTP handler runs on.
 */
export const asMember = <A>(work: () => Promise<A>) =>
  Effect.gen(function* () {
    const member = yield* CurrentMember;
    return yield* Effect.tryPromise({
      try: () => asIdentity(member, work),
      catch: apiFailure,
    });
  });
