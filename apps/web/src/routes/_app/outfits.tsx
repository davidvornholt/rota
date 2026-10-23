import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { planningFn } from '#/features/rota/services/planning-fns.ts';
import { OutfitsPage } from '#/features/rota/ui/outfits-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const searchSchema = z.object({
  favourites: z.boolean().optional(),
  collection: z.array(z.string()).optional(),
});
const OutfitsRoute = () => {
  const navigate = Route.useNavigate();
  const { favourites = false, collection = [] } = Route.useSearch();
  return (
    <OutfitsPage
      initial={Route.useLoaderData()}
      filter={{ favourites, collections: collection }}
      onFilter={(filter) => {
        navigate({
          search: {
            ...(filter.favourites ? { favourites: true } : {}),
            ...(filter.collections.length === 0
              ? {}
              : { collection: [...filter.collections] }),
          },
          replace: true,
          resetScroll: false,
        }).catch(() => undefined);
      }}
    />
  );
};

export const Route = createFileRoute('/_app/outfits')({
  validateSearch: searchSchema,
  loader: () => planningFn({ data: { date: null } }),
  component: OutfitsRoute,
  head: () => ({ meta: [{ title: pageTitle('Outfits') }] }),
});
