import { createFileRoute } from '@tanstack/react-router';

/** Liveness probe for container healthchecks; deliberately touches no database. */
export const Route = createFileRoute('/api/healthz')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' }),
    },
  },
});
