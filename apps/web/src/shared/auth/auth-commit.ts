import { deviceTokenPath } from '@rota/api/device-login';
import { Schema } from 'effect';

const httpErrorStatus = 400;

/**
 * Whether a transaction keeps its writes. Better Auth answers errors as HTTP
 * responses and OAuth success as redirects, so an error answer rolls back the
 * credential and session writes made on the way to it.
 */
export const commitsResult = (result: unknown): boolean =>
  !(result instanceof Response && result.status >= httpErrorStatus);

/**
 * The RFC 8628 (section 3.5) answers to a device token poll. Better Auth's
 * device-authorization plugin records `lastPolledAt` before it answers
 * `authorization_pending`, and deletes the device code before it answers
 * `expired_token` or `access_denied`. These writes are the grant's state, not
 * a failed attempt: rolled back, a client that polls too fast never gets
 * `slow_down`, and an expired or denied code is never cleared. `slow_down`
 * itself writes nothing.
 */
const isDevicePollingAnswer = Schema.is(
  Schema.Struct({
    error: Schema.Literals([
      'authorization_pending',
      'slow_down',
      'expired_token',
      'access_denied',
    ]),
  }),
);

/** Whether the transaction around an auth request keeps its writes. */
export const commitsAuthAnswer = async (
  request: Request,
  response: Response,
): Promise<boolean> =>
  commitsResult(response) ||
  (new URL(request.url).pathname === deviceTokenPath &&
    isDevicePollingAnswer(
      // A body that is not JSON is not a polling answer, so it rolls back.
      await response
        .clone()
        .json()
        .catch(() => null),
    ));
