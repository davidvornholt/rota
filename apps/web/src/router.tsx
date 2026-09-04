import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { createQueryContext } from '#/shared/query/query-context.ts';
import { RouterError, RouterNotFound } from '#/shared/ui/router-fallbacks.tsx';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const context = createQueryContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouterError,
    defaultNotFoundComponent: RouterNotFound,
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  return router;
};

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: TanStack Router requires interface merging for router registration.
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
