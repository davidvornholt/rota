import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { hasAuthorizedSession } from './session.ts';

/**
 * Reads the better-auth session from the request headers. If the session
 * lookup fails (for example when the database is unreachable), the visitor
 * counts as signed out — public routes stay reachable that way.
 *
 * Deliberately unauthenticated: the login route calls it while signed out, so
 * it is the one server function exempt from `sessionRequired`.
 */
export const hasAuthorizedSessionFn = createServerFn({
  method: 'GET',
}).handler(
  (): Promise<boolean> =>
    hasAuthorizedSession(getRequest().headers).catch(() => false),
);
