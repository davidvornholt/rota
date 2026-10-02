import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { garmentsRuntime } from '#/features/garments/services/garments-runtime.ts';
import { currentIdentity } from '#/shared/auth/identity.ts';
import {
  approvePrivateResponse,
  privateResponseHeaders,
} from '#/shared/auth/private-response.ts';
import { guardedRoute } from '#/shared/auth/route-guard.ts';
import { pool } from '#/shared/db/pool.ts';
import { isMediaKey, mimeOfKey } from '#/shared/media/media-keys.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { requestedVariant } from '#/shared/media/media-variants.ts';

const notFound = () =>
  approvePrivateResponse(
    new Response('Not found.', {
      status: 404,
      headers: privateResponseHeaders,
    }),
  );
const routePrefix = /^\/api\/media\//u;

/**
 * Serves a stored image, or a smaller copy of it with `?w=`, to the wardrobe's
 * owner or an administrator. Like every authenticated response, it stays out
 * of caches.
 */
const serveMedia = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(routePrefix, ''));
  const mime = mimeOfKey(key);
  const requested = requestedVariant(url);
  if (!isMediaKey(key) || mime === undefined || requested.kind === 'invalid') {
    return notFound();
  }
  const actor = currentIdentity();
  const access = await pool.query(
    `select 1 from garment_image i join garment g on g.id = i.garment_id
    where i.storage_key = $1 and (g.owner_id = $2 or $3) limit 1`,
    [key, actor.id, actor.admin],
  );
  if (!access.rowCount) {
    return notFound();
  }
  const served = await garmentsRuntime.run(
    Effect.flatMap(MediaStore, (media) =>
      requested.kind === 'variant'
        ? media.variant(key, requested.width)
        : media
            .get(key)
            .pipe(
              Effect.map((bytes) =>
                bytes === undefined ? undefined : { bytes, mime },
              ),
            ),
    ),
  );
  if (served === undefined) {
    return notFound();
  }
  return new Response(served.bytes as BodyInit, {
    headers: {
      'content-type': served.mime,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const Route = createFileRoute('/api/media/$')({
  server: {
    handlers: {
      GET: guardedRoute(serveMedia),
    },
  },
});
