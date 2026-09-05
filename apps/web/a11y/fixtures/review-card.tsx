import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GarmentDetailPage } from '#/features/garments/ui/garment-detail-page.tsx';
import { WardrobePage } from '#/features/garments/ui/wardrobe-page.tsx';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { fixtureGarment, setFixtureGarment } from './garments-fns.ts';

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
  colors: [{ name: 'Blue', hex: '#336699' }],
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
  studioRenderId: null,
  studioRenderCompletedId: null,
  image: photo,
  original: photo,
  studio: undefined,
  wears: 0,
  lastWornOn: null,
  daysSinceWorn: null,
  costPerWear: null,
};

const detail = new URLSearchParams(location.search).has('detail');
if (detail) {
  Object.assign(garment, { status: 'active', studio: photo });
}
setFixtureGarment(garment);

export const ReviewFixture = () => {
  const [current, setCurrent] = useState(garment);
  return (
    <main>
      <button
        type="button"
        onClick={() => {
          const next = {
            ...fixtureGarment(),
            studio: {
              ...photo,
              url: `${photo.url}?studio=${crypto.randomUUID()}`,
            },
            studioRenderCompletedId: fixtureGarment().studioRenderId,
          };
          setFixtureGarment(next);
          setCurrent(next);
        }}
      >
        Finish render
      </button>
      <button
        type="button"
        onClick={() =>
          setFixtureGarment({
            ...fixtureGarment(),
            processingError: 'Image provider unavailable',
          })
        }
      >
        Fail render
      </button>
      {detail ? (
        <>
          <h1>Garment details</h1>
          <GarmentDetailPage initial={current} categoryBudgets={{}} />
        </>
      ) : (
        <WardrobePage
          categoryBudgets={{}}
          view={{
            today: localDate('2026-09-05'),
            queue: [current],
            active: [],
            retired: [],
          }}
        />
      )}
      <output aria-label="Accepted garment" />
      <output aria-label="Render request" />
    </main>
  );
};
const router = createRouter({
  routeTree: createRootRoute({ component: ReviewFixture }),
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
