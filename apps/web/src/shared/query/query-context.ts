import { QueryClient } from '@tanstack/react-query';

/** Router context: one QueryClient per request or per browser session. */
export const createQueryContext = () => ({
  queryClient: new QueryClient(),
});
