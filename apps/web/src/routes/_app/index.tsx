import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { planningFn } from '#/features/rota/services/planning-fns.ts';
import { TodayPage } from '#/features/rota/ui/today-page.tsx';
import { addDays, localDate } from '#/shared/time/local-date.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const searchSchema = z.object({
  date: z.iso.date().optional(),
  garment: z.string().optional(),
  outfit: z.string().optional(),
  panel: z.enum(['outfits', 'laundry']).optional(),
});
const TodayRoute = () => {
  const initial = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <TodayPage
      key={`${initial.day.today}-${search.garment ?? ''}-${search.outfit ?? ''}-${search.panel ?? ''}`}
      initial={initial}
      seed={search.garment}
      savedOutfitId={search.outfit}
      panel={search.panel}
    />
  );
};
export const Route = createFileRoute('/_app/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const view = await planningFn({
      data: { date: deps.date === undefined ? null : localDate(deps.date) },
    });
    if (
      deps.date === undefined &&
      (deps.garment !== undefined || deps.outfit !== undefined) &&
      view.day.worn !== null
    ) {
      throw redirect({
        to: '/',
        search: { ...deps, date: addDays(view.actualToday, 1) },
      });
    }
    return view;
  },
  component: TodayRoute,
  head: () => ({ meta: [{ title: pageTitle('Outfit') }] }),
});
