import { createFileRoute } from '@tanstack/react-router';

import { env } from '#/shared/env.ts';
import { makeDatabaseCheck } from '#/shared/health/database-health.ts';

const serviceUnavailable = 503;
const headers = { 'cache-control': 'no-store' };

const isDatabaseAvailable = makeDatabaseCheck(env.DATABASE_URL);

export const getHealth = async (): Promise<Response> =>
  (await isDatabaseAvailable())
    ? Response.json({ status: 'ok' }, { headers })
    : new Response(null, { status: serviceUnavailable, headers });

/**
 * Health probe for the container, the release switch and the host's deploy
 * check. It answers 200 only while the database answers, because no page can
 * load data without it. A failure carries no details, since the route is public.
 */
export const Route = createFileRoute('/api/healthz')({
  server: {
    handlers: {
      GET: getHealth,
    },
  },
});
