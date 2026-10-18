import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { LaundryPage } from '#/features/rota/ui/laundry-page.tsx';
import { OutfitsPage } from '#/features/rota/ui/outfits-page.tsx';
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { linkButtonClass } from '#/shared/ui/classes.ts';
import { planningFixture, tomorrow } from './planning-fns.ts';
import { demoProposal } from './today-proposal.ts';

const params = new URLSearchParams(globalThis.location.search);
// The app shell's navigation without its session: the planning pages only.
const pages = [
  { to: '/', label: 'Planning' },
  { to: '/outfits', label: 'Outfits' },
  { to: '/laundry', label: 'Laundry' },
] as const;
const rootRoute = createRootRoute({
  component: () => (
    <>
      <nav aria-label="Main">
        <ul className="flex gap-4 px-5">
          {pages.map((item) => (
            <li key={item.to}>
              <Link className={linkButtonClass} to={item.to}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
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
    </>
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
    collection: Array.isArray(search.collection)
      ? search.collection.filter((name) => typeof name === 'string')
      : undefined,
  }),
  loader: () => structuredClone(planningFixture(demoProposal.today)),
  component: () => {
    const navigate = outfitsRoute.useNavigate();
    return (
      <OutfitsPage
        initial={outfitsRoute.useLoaderData<typeof router>()}
        filter={outfitsRoute.useSearch<typeof router>().collection ?? []}
        onFilter={(filter) => {
          navigate({
            search: {
              collection: filter.length === 0 ? undefined : [...filter],
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
  routeTree: rootRoute.addChildren([route, outfitsRoute, laundryRoute]),
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
