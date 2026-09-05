import { createFileRoute, notFound } from '@tanstack/react-router';

import { garmentFn } from '#/features/garments/services/garments-fns.ts';
import { GarmentDetailPage } from '#/features/garments/ui/garment-detail-page.tsx';
import { readSettingsFn } from '#/features/settings/services/settings-fns.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const GarmentRoute = () => {
  const { garment, settings } = Route.useLoaderData();
  return (
    <GarmentDetailPage
      categoryBudgets={settings.categoryBudgets}
      initial={garment}
      key={garment.id}
    />
  );
};

export const Route = createFileRoute('/_app/wardrobe/$garmentId')({
  loader: async ({ params }) => {
    if (!uuidPattern.test(params.garmentId)) {
      throw notFound();
    }
    const [garment, settings] = await Promise.all([
      garmentFn({ data: { id: params.garmentId } }).catch(() => {
        throw notFound();
      }),
      readSettingsFn(),
    ]);
    return { garment, settings };
  },
  component: GarmentRoute,
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.garment.name ?? 'Garment') }],
  }),
});
