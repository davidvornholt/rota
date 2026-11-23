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
// Tests reload the loader the way the router's background refresh does.
Object.assign(globalThis, { refreshSettings: () => router.invalidate() });
const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
