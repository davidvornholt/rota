import { createFileRoute, notFound } from '@tanstack/react-router';

import { dayFn } from '#/features/history/services/history-fns.ts';
import { DayPage } from '#/features/history/ui/day-page.tsx';
import { logOutfitFn } from '#/features/rota/services/today-fns.ts';
import { isLocalDate } from '#/shared/time/local-date.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const DayRoute = () => (
  <DayPage
    save={(date, entries) =>
      logOutfitFn({ data: { date, entries, source: 'edited' } })
    }
    view={Route.useLoaderData()}
  />
);

export const Route = createFileRoute('/_app/history/$date')({
  loader: ({ params }) => {
    if (!isLocalDate(params.date)) {
      throw notFound();
    }
    return dayFn({ data: { date: params.date } });
  },
  component: DayRoute,
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.date ?? 'Day') }],
  }),
});
