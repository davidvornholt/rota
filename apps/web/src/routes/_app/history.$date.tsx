import { createFileRoute, notFound } from '@tanstack/react-router';

import { dayFn } from '#/features/history/services/history-fns.ts';
import { DayPage } from '#/features/history/ui/day-page.tsx';
import { logOutfitFn } from '#/features/rota/services/today-fns.ts';
import { SaveOutfitButton } from '#/features/rota/ui/save-outfit-button.tsx';
import { isLocalDate } from '#/shared/time/local-date.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const DayRoute = () => {
  const view = Route.useLoaderData();
  return (
    <DayPage
      renderSaveOutfit={(entries) => (
        <SaveOutfitButton entries={entries} today={view.today} />
      )}
      save={(date, entries) =>
        logOutfitFn({ data: { date, entries, source: 'edited' } })
      }
      view={view}
    />
  );
};

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
