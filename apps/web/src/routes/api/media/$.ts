import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';

import { garmentsRuntime } from '#/features/garments/services/garments-runtime.ts';
import { guardedRoute } from '#/shared/auth/route-guard.ts';
import {
  isMediaKey,
  MediaStore,
  mimeOfKey,
} from '#/shared/media/media-store.ts';

const notFound = () => new Response('Not found.', { status: 404 });
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
  const bytes = await garmentsRuntime.run(
    Effect.flatMap(MediaStore, (media) => media.get(key)),
  );
  if (bytes === undefined) {
    return notFound();
  }
  return new Response(bytes as BodyInit, {
    headers: {
      'content-type': mime,
      'cache-control': 'private, max-age=31536000, immutable',
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
