import { createFileRoute } from '@tanstack/react-router';

import { todayFn } from '#/features/rota/services/today-fns.ts';
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const TodayRoute = () => <TodayPage initial={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/')({
  loader: () => todayFn(),
  component: TodayRoute,
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
});
