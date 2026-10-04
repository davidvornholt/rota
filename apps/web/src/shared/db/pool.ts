import { createPool } from '@rota/db/pool';

import { env } from '#/shared/env.ts';

/**
 * The pool better-auth's Drizzle adapter and the raw admin queries use. The
 * Effect SQL client keeps its own; see `shared/runtime/infrastructure.ts`.
 */
export const pool = createPool(env.DATABASE_URL);
