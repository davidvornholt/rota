import { z } from 'zod';

/**
 * better-auth sends a failed OAuth callback to the caller's `errorCallbackURL`
 * with `?error=<code>` and sometimes `error_description`. Only the code is
 * useful here, and the query string comes from the browser: anything else reads
 * as "no error" rather than failing the route.
 */
const oauthErrorSearch = z.object({ error: z.string().optional() }).catch({});

export const parseOAuthErrorSearch = (search: unknown) =>
  oauthErrorSearch.parse(search);
