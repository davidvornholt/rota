/**
 * The server bundle's entry: TanStack Start's request handler, plus the hook
 * `scripts/serve.ts` calls on shutdown to close the database pools.
 */

import handler from '@tanstack/react-start/server-entry';

import { closeDatabase } from '#/shared/db/database.ts';

export default {
  fetch: (request: Request) => handler.fetch(request),
  closeDatabase,
};
