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
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { decisionCalls, undecided } from './garments-fns.ts';
import {
  demoProposal,
  fixtureProposal,
  setFixtureProposal,
} from './today-proposal.ts';

if (new URLSearchParams(globalThis.location.search).has('proposal')) {
  setFixtureProposal(demoProposal);
}

let loaderCalls = 0;
let loaderView = undecided;
const route = createRootRoute({
  loader: () =>
    Effect.runPromise(
      Effect.sync(() => {
        loaderCalls += 1;
        return {
          view: structuredClone(fixtureProposal ?? loaderView),
          loaderCalls,
          decisionCalls,
        };
      }),
    ),
  component: (): ReactElement => {
    const data = route.useLoaderData<typeof router>();
    return (
      <main>
        <h1>Today</h1>
        <output aria-label="Loader calls">{data.loaderCalls}</output>
        <output aria-label="Decision calls">{data.decisionCalls}</output>
        <button
          type="button"
          onClick={() => {
            router.invalidate().catch(() => undefined);
          }}
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => {
            loaderView = { ...undecided, worn: [] };
            router.invalidate().catch(() => undefined);
          }}
        >
          Show logged day
        </button>
        <button
          type="button"
          onClick={() => {
            loaderView = undecided;
            router.invalidate().catch(() => undefined);
          }}
        >
          Show undecided day
        </button>
        <TodayPage initial={data.view} />
      </main>
    );
  },
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
