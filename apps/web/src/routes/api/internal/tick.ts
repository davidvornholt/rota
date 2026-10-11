import { createFileRoute } from '@tanstack/react-router';
import {
  measureStudioRenders,
  warmMediaCopies,
} from '#/features/garments/services/media-warmup.ts';
import { runScheduledTick } from '#/features/rota/services/rota-runtime.ts';

/** Name of the header the serving process uses to prove a tick is its own. */
export const tickTokenHeader = 'x-rota-tick-token';

/**
 * The scheduler's door. The server process (scripts/serve.ts) calls this
 * route in-process once a minute with a token it minted at boot and put in
 * the environment; nothing else knows the token, so nothing else can make the
 * app spend a model call. Each tick also prepares smaller picture copies and
 * measures studio renders the collage cannot place yet.
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
        const [outcome, warmed, measured] = await Promise.all([
          runScheduledTick(),
          warmMediaCopies(),
          measureStudioRenders(),
        ]);
        return Response.json({ outcome, warmed, measured });
      },
    },
  },
});
