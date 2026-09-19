import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { UsagePanel } from '#/features/people/ui/usage-panel.tsx';

const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={new QueryClient()}>
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="type-display text-5xl">People</h1>
        <UsagePanel />
      </main>
    </QueryClientProvider>,
  );
}
