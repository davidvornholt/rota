import { createFileRoute } from '@tanstack/react-router';
import { PeoplePage } from '#/features/people/ui/people-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';
export const Route = createFileRoute('/_app/people/')({
  component: PeoplePage,
  head: () => ({ meta: [{ title: pageTitle('People') }] }),
});
