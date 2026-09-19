import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from '#/features/settings/ui/settings-page.tsx';
import { settings } from './settings-fns.ts';

const route = createRootRoute({
  loader: () => structuredClone(settings),
  component: () => (
    <main className="py-8">
      <SettingsPage initial={route.useLoaderData<typeof router>()} />
    </main>
  ),
});
const router = createRouter({
  routeTree: route,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});
const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
