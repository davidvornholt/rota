import { setResponseHeader } from '@tanstack/react-start/server';

import { applyPrivateResponseHeaders } from './private-response.ts';

/**
 * Puts the private response headers on the response of the running request.
 * `getResponseHeaders()` returns a read-only snapshot, so setting headers on it
 * changes nothing; only the `setResponseHeader` helper reaches the response.
 */
export const publishPrivateResponseHeaders = (): void =>
  applyPrivateResponseHeaders({
    set: (name, value) => setResponseHeader(name, value),
  });
