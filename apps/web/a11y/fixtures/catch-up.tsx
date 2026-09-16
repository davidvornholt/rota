import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { Effect } from 'effect';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { CatchUpView } from '#/features/history/services/history-fns.ts';
import { CatchUpPage } from '#/features/history/ui/catch-up-page.tsx';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { shirt } from './today-proposal.ts';

const garment = (
  id: string,
  name: string,
  slots: GarmentView['slots'],
  hex: string,
): GarmentView => ({ ...shirt, id, name, slots, colors: [{ hex }] });

const chinos = garment('demo-chinos', 'Navy chinos', ['bottom'], '#2b3a55');
const jeans = garment('demo-jeans', 'Indigo jeans', ['bottom'], '#3b4a7a');
const tee = garment('demo-tee', 'White tee', ['top'], '#f2f2f2');
const coat = garment('demo-coat', 'Wax jacket', ['over'], '#4a3b2a');

const showery: Omit<WeatherDay, 'date' | 'issuedOn'> = {
  locationLabel: 'Berlin',
  high: 18.4,
  low: 11.2,
  precipitationProbability: 40,
  precipitationMm: 1.2,
  windKmh: 12,
  weatherCode: 61,
};
const weather = (date: string): WeatherDay => ({
  ...showery,
  date: localDate(date),
  issuedOn: localDate(date),
});

const threeDays: CatchUpView = {
  today: localDate('2026-09-07'),
  lastLogged: {
    date: localDate('2026-09-03'),
    outfit: { bottom: chinos.id, top: shirt.id },
    names: [chinos.name, shirt.name],
  },
  days: [
    {
      date: localDate('2026-09-04'),
      weather: weather('2026-09-04'),
      occasion: 'Team offsite',
    },
    { date: localDate('2026-09-05'), weather: null, occasion: null },
    {
      date: localDate('2026-09-06'),
      weather: weather('2026-09-06'),
      occasion: null,
    },
  ],
  choices: {
    bottom: [chinos, jeans],
    under: [],
    top: [shirt, tee],
    over: [coat],
  },
};

const params = new URLSearchParams(globalThis.location.search);
const viewFor = (): CatchUpView => {
  if (params.has('fresh')) {
    return { ...threeDays, lastLogged: null, days: [] };
  }
  return params.has('empty') ? { ...threeDays, days: [] } : threeDays;
};
const view = viewFor();

const route = createRootRoute({
  component: (): ReactElement => (
    <main>
      <output aria-label="Saved days" />
      <CatchUpPage
        save={(days) =>
          Effect.runPromise(
            Effect.sync(() => {
              const saved = document.querySelector('[aria-label="Saved days"]');
              if (saved !== null) {
                saved.textContent = JSON.stringify(days);
              }
            }),
          )
        }
        view={view}
      />
    </main>
  ),
});
const router = createRouter({
  routeTree: route,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});
const client = new QueryClient();
const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
