import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { PeoplePage } from '#/features/people/ui/people-page.tsx';
import { AppShell } from '#/shared/ui/app-shell.tsx';

const shell = new URLSearchParams(globalThis.location.search).has('shell');
const route = createRootRoute({
  component: () =>
    shell ? (
      <AppShell />
    ) : (
      <main className="py-8">
        <Outlet />
      </main>
    ),
});
const people = createRoute({
  getParentRoute: () => route,
  path: '/',
  component: PeoplePage,
});
const wardrobe = createRoute({
  getParentRoute: () => route,
  path: '/wardrobe',
  component: () => <h1>My editable wardrobe</h1>,
});
const inspection = createRoute({
  getParentRoute: () => route,
  path: '/people/$memberId',
  component: () => <h1>Read-only wardrobe</h1>,
});
const router = createRouter({
  routeTree: route.addChildren([people, wardrobe, inspection]),
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
