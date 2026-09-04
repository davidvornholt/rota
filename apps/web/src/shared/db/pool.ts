import { createPool } from '@rota/db/pool';

import { env } from '#/shared/env.ts';

/** One process, one pool: better-auth's Drizzle adapter and the Effect SQL client share it. */
export const pool = createPool(env.DATABASE_URL);
