import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { Effect } from 'effect';
import { createRoot } from 'react-dom/client';
import { DayPage } from '#/features/history/ui/day-page.tsx';
import { SaveOutfitButton } from '#/features/rota/ui/save-outfit-button.tsx';
import { demoProposal, shirt } from './today-proposal.ts';

const bottom = {
  ...shirt,
  id: 'demo-chinos',
  name: 'Navy chinos',
  slots: ['bottom'] as const,
  colors: [{ hex: '#24364b' }],
};
const route = createRootRoute({
  component: () => (
    <main className="py-8">
      <output aria-label="Day saves">0</output>
      <DayPage
        view={{
          date: demoProposal.today,
          today: demoProposal.today,
          weather: null,
          occasion: null,
          headline: null,
          worn: [
            { slot: 'bottom', garment: bottom },
            { slot: 'top', garment: shirt },
          ],
          choices: {
            bottom: [bottom],
            top: [shirt],
            under: [],
            over: [],
            shoes: [],
            bag: [],
          },
        }}
        save={() =>
          Effect.runPromise(
            Effect.sync(() => {
              const output = document.querySelector('[aria-label="Day saves"]');
              if (output !== null) {
                output.textContent = '1';
              }
            }),
          )
        }
        renderSaveOutfit={(entries) => (
          <SaveOutfitButton entries={entries} today={demoProposal.today} />
        )}
      />
    </main>
  ),
});
const router = createRouter({
  routeTree: route,
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
