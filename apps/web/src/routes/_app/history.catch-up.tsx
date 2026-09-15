import { createFileRoute } from '@tanstack/react-router';

import { catchUpFn } from '#/features/history/services/history-fns.ts';
import { CatchUpPage } from '#/features/history/ui/catch-up-page.tsx';
import { logDaysFn } from '#/features/rota/services/today-fns.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const CatchUpRoute = () => (
  <CatchUpPage
    save={(days) => logDaysFn({ data: { days } })}
    view={Route.useLoaderData()}
  />
);

export const Route = createFileRoute('/_app/history/catch-up')({
  loader: () => catchUpFn(),
  component: CatchUpRoute,
  head: () => ({ meta: [{ title: pageTitle('Catch up') }] }),
});
