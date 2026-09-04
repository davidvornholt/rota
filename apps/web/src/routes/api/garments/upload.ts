import { createFileRoute } from '@tanstack/react-router';

import { handleUpload } from '#/features/garments/services/upload.ts';
import { guardedRoute } from '#/shared/auth/route-guard.ts';

export const Route = createFileRoute('/api/garments/upload')({
  server: {
    handlers: {
      POST: guardedRoute(handleUpload),
    },
  },
});
