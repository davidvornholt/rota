import { createFileRoute } from '@tanstack/react-router';
import { JoinPage } from '#/features/access/ui/access-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';
export const Route = createFileRoute('/join')({
  component: JoinPage,
  head: () => ({ meta: [{ title: pageTitle('Set up access') }] }),
});
