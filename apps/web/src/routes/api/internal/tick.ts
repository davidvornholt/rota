import { createFileRoute } from '@tanstack/react-router';
import { runScheduledTick } from '#/features/rota/services/rota-runtime.ts';

/** Name of the header the serving process uses to prove a tick is its own. */
export const tickTokenHeader = 'x-rota-tick-token';

/**
 * The scheduler's door. The server process (scripts/serve.ts) calls this
 * route in-process once a minute with a token it minted at boot and put in
 * the environment; nothing else knows the token, so nothing else can make the
 * app spend a model call.
 */
export const Route = createFileRoute('/api/internal/tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROTA_TICK_TOKEN;
        if (
          expected === undefined ||
          expected === '' ||
          request.headers.get(tickTokenHeader) !== expected
        ) {
          return new Response('Not authorized.', { status: 401 });
        }
        const outcome = await runScheduledTick();
        return Response.json({ outcome });
      },
    },
  },
});
