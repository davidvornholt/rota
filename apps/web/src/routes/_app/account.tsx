import { createFileRoute } from '@tanstack/react-router';
import { PasskeysPage } from '#/features/access/ui/passkeys-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';
export const Route = createFileRoute('/_app/account')({
  component: PasskeysPage,
  head: () => ({ meta: [{ title: pageTitle('Passkeys') }] }),
});
