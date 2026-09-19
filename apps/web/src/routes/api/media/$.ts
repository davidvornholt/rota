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

const notFound = () =>
  approvePrivateResponse(
    new Response('Not found.', {
      status: 404,
      headers: privateResponseHeaders,
    }),
  );
const routePrefix = /^\/api\/media\//u;

/**
 * Serves stored images when the media store has no public domain (development,
 * or a bucket without a custom domain). Keys are content hashes, so a hit can
 * be cached for good.
 */
const serveMedia = async (request: Request): Promise<Response> => {
  const key = decodeURIComponent(
    new URL(request.url).pathname.replace(routePrefix, ''),
  );
  const mime = mimeOfKey(key);
  if (!isMediaKey(key) || mime === undefined) {
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
  const bytes = await garmentsRuntime.run(
    Effect.flatMap(MediaStore, (media) => media.get(key)),
  );
  if (bytes === undefined) {
    return notFound();
  }
  return new Response(bytes as BodyInit, {
    headers: {
      'content-type': mime,
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
