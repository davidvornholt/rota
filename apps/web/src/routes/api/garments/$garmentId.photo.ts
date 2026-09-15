import { createFileRoute } from '@tanstack/react-router';

import { handleReplacePhoto } from '#/features/garments/services/upload.ts';
import { guardedRoute } from '#/shared/auth/route-guard.ts';

export const Route = createFileRoute('/api/garments/$garmentId/photo')({
  server: {
    handlers: {
      POST: guardedRoute((request, params: { readonly garmentId: string }) =>
        handleReplacePhoto(request, params.garmentId),
      ),
    },
  },
});
