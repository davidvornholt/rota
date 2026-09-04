import { createFileRoute } from '@tanstack/react-router';

import { readSettingsFn } from '#/features/settings/services/settings-fns.ts';
import { SettingsPage } from '#/features/settings/ui/settings-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const SettingsRoute = () => <SettingsPage initial={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/settings')({
  loader: () => readSettingsFn(),
  component: SettingsRoute,
  head: () => ({ meta: [{ title: pageTitle('Settings') }] }),
});
