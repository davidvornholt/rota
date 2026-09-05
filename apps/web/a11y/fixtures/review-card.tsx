import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GarmentDetailPage } from '#/features/garments/ui/garment-detail-page.tsx';
import { WardrobePage } from '#/features/garments/ui/wardrobe-page.tsx';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';

const photo = {
  url: '/a11y/fixtures/shirt.svg',
  width: 300,
  height: 400,
  fit: 'contain',
} as const;
const garment: GarmentView = {
  id: 'demo-shirt',
  status: 'review',
  name: 'Blue Oxford shirt',
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  effectiveBudget: 2,
  colors: [],
  pattern: '',
  material: 'Cotton',
  fit: '',
  sleeve: '',
  brand: '',
  seasons: [],
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'original',
  processingError: null,
  studioError: null,
  studioState: { status: 'rendering' },
  image: photo,
  original: photo,
  studio: undefined,
  wears: 0,
  lastWornOn: null,
  daysSinceWorn: null,
  costPerWear: null,
};

const cooldownMs = 60_000;
const query = new URLSearchParams(globalThis.location.search);
const detail = query.has('detail');
let current: GarmentView = {
  ...garment,
  status: detail ? 'active' : 'review',
  studioState: query.has('waiting')
    ? { status: 'waiting', retryAt: Date.now() + cooldownMs }
    : garment.studioState,
};

const finish = () => {
  current = {
    ...current,
    studioState: { status: 'succeeded' },
    studioError: null,
    studio: { ...photo, url: `${photo.url}?studio` },
  };
};
const wait = () => {
  current = {
    ...current,
    studioState: { status: 'waiting', retryAt: Date.now() + cooldownMs },
  };
};
const fail = () => {
  current = {
    ...current,
    studioState: { status: 'failed' },
    studioError:
      'The image service is busy. Try the studio picture again later.',
  };
};
const enqueue = () => {
  current = {
    ...current,
    studioState: { status: 'queued' },
    studioError: null,
  };
};

export const ReviewFixture = () => {
  const loaded = route.useLoaderData();
  useEffect(() => {
    document.addEventListener('studio-retry', enqueue);
    return () => document.removeEventListener('studio-retry', enqueue);
  }, []);
  return (
    <main>
      <fieldset aria-label="Fixture controls">
        <button type="button" onClick={finish}>
          Finish render
        </button>
        <button type="button" onClick={wait}>
          Rate limit
        </button>
        <button type="button" onClick={fail}>
          Fail render
        </button>
      </fieldset>
      {detail ? (
        <GarmentDetailPage categoryBudgets={{}} initial={loaded} />
      ) : (
        <WardrobePage
          categoryBudgets={{}}
          view={{
            today: localDate('2026-09-05'),
            queue: [loaded],
            active: [],
            retired: [],
          }}
        />
      )}
      <output aria-label="Accepted garment" />
    </main>
  );
};
const rootRoute = createRootRoute();
const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ReviewFixture,
  loader: () => ({ ...current }),
});
const router = createRouter({
  routeTree: rootRoute.addChildren([route]),
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
