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
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { planningFixture, tomorrow } from './planning-fns.ts';
import { demoProposal } from './today-proposal.ts';

const params = new URLSearchParams(globalThis.location.search);
const rootRoute = createRootRoute({
  component: () => (
    <main className="py-8">
      <Outlet />
    </main>
  ),
});
const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === 'string' ? search.date : demoProposal.today,
    outfit: typeof search.outfit === 'string' ? search.outfit : undefined,
  }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: ({ deps }) => structuredClone(planningFixture(deps.date)),
  component: () => {
    const initial = route.useLoaderData<typeof router>();
    return (
      <TodayPage
        key={initial.day.today}
        initial={initial}
        savedOutfitId={route.useSearch<typeof router>().outfit}
      />
    );
  },
});
const router = createRouter({
  routeTree: rootRoute.addChildren([route]),
  history: createMemoryHistory({
    initialEntries: [
      `/?date=${params.has('tomorrow') ? tomorrow : demoProposal.today}`,
    ],
  }),
});
const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
