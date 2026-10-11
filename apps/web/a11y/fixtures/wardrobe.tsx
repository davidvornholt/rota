import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { WardrobePage } from '#/features/garments/ui/wardrobe-page.tsx';
import { uploadEndpoint } from '#/features/garments/upload-contract.ts';
import type {
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { shirt } from './today-proposal.ts';

const picture = (file: string, fit: GarmentImageView['fit']) =>
  ({
    url: `/a11y/fixtures/${file}`,
    srcSet: `/a11y/fixtures/${file} 300w`,
    width: 300,
    height: 400,
    fit,
    content: null,
  }) as const;

type DemoGarment = {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly image?: GarmentImageView;
  readonly wears: number;
};

const garment = ({
  id,
  name,
  hex,
  image,
  wears,
}: DemoGarment): GarmentView => ({
  ...shirt,
  id,
  name,
  colors: [{ hex }],
  image,
  studio: image,
  wears,
  daysSinceWorn: wears === 0 ? null : wears + 1,
});

const active: ReadonlyArray<GarmentView> = [
  garment({
    id: 'demo-shirt',
    name: 'Blue Oxford shirt',
    hex: '#536e8a',
    image: picture('shirt.svg', 'contain'),
    wears: 4,
  }),
  garment({
    id: 'demo-chinos',
    name: 'Stone chinos',
    hex: '#b59a6a',
    image: picture('trousers.svg', 'contain'),
    wears: 2,
  }),
  garment({
    id: 'demo-knit',
    name: 'Bottle-green jumper',
    hex: '#2f4a3a',
    image: picture('knit.svg', 'contain'),
    wears: 0,
  }),
  garment({ id: 'demo-tee', name: 'White T-shirt', hex: '#f4f2ec', wears: 7 }),
  garment({
    id: 'demo-coat',
    name: 'Navy wool coat',
    hex: '#22304a',
    wears: 1,
  }),
];

/**
 * Stands in for the server's queue: every photo the upload endpoint accepted
 * comes back as a garment still being read, with the photo it was sent.
 */
const received: Array<GarmentView> = [];
const serverFetch = globalThis.fetch;
const recordingFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await serverFetch(input, init);
  const body = init?.body;
  if (
    String(input) === uploadEndpoint &&
    response.ok &&
    body instanceof FormData
  ) {
    const { ids } = (await response.clone().json()) as {
      readonly ids: ReadonlyArray<string>;
    };
    const photos = body
      .getAll('photo')
      .filter((entry) => entry instanceof File);
    ids.forEach((id, index) => {
      const photo = photos[index];
      const url = photo === undefined ? '' : URL.createObjectURL(photo);
      received.unshift({
        ...garment({ id, name: 'New garment', hex: '#cccccc', wears: 0 }),
        status: 'processing',
        original: {
          url,
          srcSet: '',
          width: 3,
          height: 4,
          fit: 'cover',
          content: null,
        },
      });
    });
  }
  return response;
};
globalThis.fetch = Object.assign(recordingFetch, {
  preconnect: serverFetch.preconnect,
});

const query = new URLSearchParams(globalThis.location.search);

export const WardrobeFixture = () => {
  const view = route.useLoaderData();
  return (
    <main>
      <WardrobePage categoryBudgets={{}} view={view} />
      {query.has('field') ? (
        <label className="mt-8 block">
          Fixture text field
          <input className="border" type="text" />
        </label>
      ) : null}
    </main>
  );
};

const rootRoute = createRootRoute();
const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: WardrobeFixture,
  loader: () => ({
    today: localDate('2026-09-07'),
    queue: [...received],
    active: query.has('empty') ? [] : active,
    retired: [],
  }),
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
