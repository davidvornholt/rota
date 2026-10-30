import { createFileRoute } from '@tanstack/react-router';
import { DevicePage } from '#/features/access/ui/device-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const DeviceRoute = () => <DevicePage userCode={Route.useSearch().user_code} />;

export const Route = createFileRoute('/_app/device')({
  component: DeviceRoute,
  head: () => ({ meta: [{ title: pageTitle('Sign in the CLI') }] }),
  validateSearch: (search: Record<string, unknown>): { user_code: string } => ({
    user_code: typeof search.user_code === 'string' ? search.user_code : '',
  }),
});
