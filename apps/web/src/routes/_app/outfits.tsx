import { createFileRoute } from '@tanstack/react-router';
import { planningFn } from '#/features/rota/services/planning-fns.ts';
import { OutfitsPage } from '#/features/rota/ui/outfits-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const OutfitsRoute = () => <OutfitsPage initial={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/outfits')({
  loader: () => planningFn({ data: { date: null } }),
  component: OutfitsRoute,
  head: () => ({ meta: [{ title: pageTitle('Outfits') }] }),
});
