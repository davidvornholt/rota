import { createFileRoute, redirect } from '@tanstack/react-router';
import { SignInPage } from '#/features/access/ui/access-page.tsx';
import { parseOAuthErrorSearch } from '#/shared/auth/oauth-error-search.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const Page = () => <SignInPage oauthError={Route.useSearch().error} />;
export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await hasAuthorizedSessionFn()) {
      throw redirect({ to: '/' });
    }
  },
  component: Page,
  validateSearch: parseOAuthErrorSearch,
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
});
