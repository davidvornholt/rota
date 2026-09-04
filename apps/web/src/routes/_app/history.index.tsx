import { createFileRoute } from '@tanstack/react-router';

import { historyFn } from '#/features/history/services/history-fns.ts';
import { HistoryPage } from '#/features/history/ui/history-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

type HistorySearch = { readonly year?: number };

const earliestYear = 2000;
const latestYear = 2100;

/** Only a plausible whole year survives; anything else reads as "this year". */
const parseSearch = (search: Record<string, unknown>): HistorySearch => {
  const year = Number(search.year);
  return Number.isInteger(year) && year >= earliestYear && year <= latestYear
    ? { year }
    : {};
};

const HistoryRoute = () => <HistoryPage view={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/history/')({
  validateSearch: parseSearch,
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: ({ deps }) => historyFn({ data: { year: deps.year } }),
  component: HistoryRoute,
  head: () => ({ meta: [{ title: pageTitle('History') }] }),
});
