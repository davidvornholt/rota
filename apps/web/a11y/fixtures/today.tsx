import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { LaundryPage } from '#/features/rota/ui/laundry-page.tsx';
import { OutfitsPage } from '#/features/rota/ui/outfits-page.tsx';
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { AppShell } from '#/shared/ui/app-shell.tsx';
import { frameClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { planningFixture, tomorrow } from './planning-fns.ts';
import { demoProposal } from './today-proposal.ts';

const params = new URLSearchParams(globalThis.location.search);
// The app's own shell, so screenshots and scans show what the app shows.
const rootRoute = createRootRoute({ component: AppShell });
// Stands in for a garment's page and its "Build an outfit" link.
const wardrobeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wardrobe',
  component: () => (
    <div className={frameClass}>
      <h1 className="type-display text-4xl">White cotton shirt</h1>
      <Link
        className={quietButtonClass}
        to="/"
        search={{ garment: 'demo-white' }}
      >
        Build an outfit
      </Link>
    </div>
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
        key={initial.day.today}
        initial={initial}
        seed={route.useSearch<typeof router>().garment}
        savedOutfitId={route.useSearch<typeof router>().outfit}
      />
    );
  },
});
// Saved outfits and laundry always show the actual today, as in the app.
const outfitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/outfits',
  validateSearch: (search: Record<string, unknown>) => ({
    favourites: search.favourites === true ? true : undefined,
    collection: Array.isArray(search.collection)
      ? search.collection.filter((name) => typeof name === 'string')
      : undefined,
  }),
  loader: () => structuredClone(planningFixture(demoProposal.today)),
  component: () => {
    const navigate = outfitsRoute.useNavigate();
    const search = outfitsRoute.useSearch<typeof router>();
    return (
      <OutfitsPage
        initial={outfitsRoute.useLoaderData<typeof router>()}
        filter={{
          favourites: search.favourites ?? false,
          collections: search.collection ?? [],
        }}
        onFilter={(filter) => {
          navigate({
            search: {
              favourites: filter.favourites ? true : undefined,
              collection:
                filter.collections.length === 0
                  ? undefined
                  : [...filter.collections],
            },
            replace: true,
            resetScroll: false,
          }).catch(() => undefined);
        }}
      />
    );
  },
});
const laundryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/laundry',
  loader: () => structuredClone(planningFixture(demoProposal.today)),
  component: () => (
    <LaundryPage initial={laundryRoute.useLoaderData<typeof router>()} />
  ),
});
const startPage = params.get('page');
const router = createRouter({
  routeTree: rootRoute.addChildren([
    route,
    outfitsRoute,
    laundryRoute,
    wardrobeRoute,
  ]),
  history: createMemoryHistory({
    initialEntries: [
      sessionStorage.getItem('planning-location') ??
        (startPage === null
          ? `/?date=${params.has('tomorrow') ? tomorrow : demoProposal.today}${params.has('garment') ? `&garment=${params.get('garment')}` : ''}`
          : `/${startPage}`),
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
