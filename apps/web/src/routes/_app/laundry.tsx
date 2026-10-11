import { createFileRoute } from '@tanstack/react-router';
import { planningFn } from '#/features/rota/services/planning-fns.ts';
import { LaundryPage } from '#/features/rota/ui/laundry-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const LaundryRoute = () => <LaundryPage initial={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/laundry')({
  loader: () => planningFn({ data: { date: null } }),
  component: LaundryRoute,
  head: () => ({ meta: [{ title: pageTitle('Laundry') }] }),
});
