import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
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
  image: photo,
  original: photo,
  studio: undefined,
  wears: 0,
  lastWornOn: null,
  daysSinceWorn: null,
  costPerWear: null,
};

export const ReviewFixture = () => {
  const [current, setCurrent] = useState(garment);
  return (
    <main>
      <button
        type="button"
        onClick={() =>
          setCurrent({
            ...current,
            studio: { ...photo, url: `${photo.url}?studio` },
          })
        }
      >
        Finish render
      </button>
      <WardrobePage
        categoryBudgets={{}}
        view={{
          today: localDate('2026-09-05'),
          queue: [current],
          active: [],
          retired: [],
        }}
      />
      <output aria-label="Accepted garment" />
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
