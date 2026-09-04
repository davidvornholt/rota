import { createFileRoute } from '@tanstack/react-router';

import { wardrobeFn } from '#/features/garments/services/garments-fns.ts';
import { WardrobePage } from '#/features/garments/ui/wardrobe-page.tsx';
import { readSettingsFn } from '#/features/settings/services/settings-fns.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const WardrobeRoute = () => {
  const { wardrobe, settings } = Route.useLoaderData();
  return (
    <WardrobePage categoryBudgets={settings.categoryBudgets} view={wardrobe} />
  );
};

export const Route = createFileRoute('/_app/wardrobe/')({
  loader: async () => {
    const [wardrobe, settings] = await Promise.all([
      wardrobeFn(),
      readSettingsFn(),
    ]);
    return { wardrobe, settings };
  },
  component: WardrobeRoute,
  head: () => ({ meta: [{ title: pageTitle('Wardrobe') }] }),
});
