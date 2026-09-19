import { createFileRoute, redirect } from '@tanstack/react-router';
import { inspectWardrobeFn } from '#/features/people/services/people-fns.ts';
import { WardrobeInspection } from '#/features/people/ui/wardrobe-inspection.tsx';
import { currentPersonFn } from '#/shared/auth/session-fn.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const Page = () => <WardrobeInspection {...Route.useLoaderData()} />;
export const Route = createFileRoute('/_app/people/$memberId')({
  loader: async ({ params }) => {
    const person = await currentPersonFn();
    if (person.id === params.memberId) {
      throw redirect({ to: '/wardrobe', replace: true });
    }
    return inspectWardrobeFn({ data: { id: params.memberId } });
  },
  component: Page,
  head: () => ({ meta: [{ title: pageTitle('Read-only wardrobe') }] }),
});
