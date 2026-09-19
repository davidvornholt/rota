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
      <button
        type="button"
        onClick={() => {
          router
            .navigate({
              to: '/',
              search: { date: demoProposal.today, garment: 'demo-white' },
            })
            .catch(() => undefined);
        }}
      >
        Start with white shirt
      </button>
      <Outlet />
    </main>
  ),
});
const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === 'string' ? search.date : demoProposal.today,
    garment: typeof search.garment === 'string' ? search.garment : undefined,
    outfit: typeof search.outfit === 'string' ? search.outfit : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => structuredClone(planningFixture(deps.date)),
  component: () => {
    const initial = route.useLoaderData<typeof router>();
    return (
      <TodayPage
        key={`${initial.day.today}-${route.useSearch<typeof router>().garment ?? ''}-${route.useSearch<typeof router>().outfit ?? ''}`}
        initial={initial}
        seed={route.useSearch<typeof router>().garment}
        savedOutfitId={route.useSearch<typeof router>().outfit}
      />
    );
  },
});
const router = createRouter({
  routeTree: rootRoute.addChildren([route]),
  history: createMemoryHistory({
    initialEntries: [
      sessionStorage.getItem('planning-location') ??
        `/?date=${params.has('tomorrow') ? tomorrow : demoProposal.today}${params.has('garment') ? `&garment=${params.get('garment')}` : ''}`,
    ],
  }),
});
router.subscribe('onResolved', () => {
  sessionStorage.setItem('planning-location', router.state.location.href);
});
const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
