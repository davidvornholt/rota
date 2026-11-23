import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';

/** After a sign-in or join, nothing an earlier session in this tab loaded may show. */
export const openWardrobe = async (
  router: Pick<AnyRouter, 'clearCache' | 'invalidate' | 'navigate'>,
  queryClient: Pick<QueryClient, 'clear'>,
) => {
  queryClient.clear();
  router.clearCache();
  await router.invalidate();
  await router.navigate({ to: '/' });
};
