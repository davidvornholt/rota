import { createFileRoute } from '@tanstack/react-router';
import { inspectWardrobeFn } from '#/features/people/services/people-fns.ts';
import { WardrobeInspection } from '#/features/people/ui/wardrobe-inspection.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const Page = () => <WardrobeInspection {...Route.useLoaderData()} />;
export const Route = createFileRoute('/_app/people/$memberId')({
  loader: ({ params }) => inspectWardrobeFn({ data: { id: params.memberId } }),
  component: Page,
  head: () => ({ meta: [{ title: pageTitle('Read-only wardrobe') }] }),
});
