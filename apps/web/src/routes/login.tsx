import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { type RefObject, useRef } from 'react';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { parseOAuthErrorSearch } from '#/shared/auth/oauth-error-search.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import {
  frameClass,
  proseClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';
import { Tally } from '#/shared/ui/tally.tsx';

const SignInPage = () => {
  const { error } = Route.useSearch();
  // A ref rather than `isPending`: two activations in one React batch would
  // both read "not pending" and open the OAuth redirect twice.
  const signInStarted: RefObject<boolean> = useRef(false);
  const signIn = useMutation({
    mutationFn: () =>
      authClient.signIn
        .social({
          provider: 'github',
          callbackURL: '/',
          errorCallbackURL: '/login',
        })
        .then(rejectAuthError),
    onSettled: () => {
      signInStarted.current = false;
    },
  });
  const startSignIn = () => {
    if (signInStarted.current) {
      return;
    }
    signInStarted.current = true;
    signIn.mutate();
  };

  return (
    <main className="flex min-h-svh flex-col justify-center bg-paper py-16">
      <div className={frameClass}>
        <div className="flex items-end gap-4">
          <h1 className="type-display text-7xl text-ink sm:text-8xl">Rota</h1>
          <span className="mb-3">
            <Tally day={3} of={4} />
          </span>
        </div>
        <p
          className={[
            proseClass,
            'mt-6 border-rule border-t pt-6 text-ink-muted text-lg',
          ].join(' ')}
        >
          What to wear today, from a wardrobe that keeps its own rotation:
          trousers for four days, a shirt for two, and a fresh one when the
          weather turns.
        </p>
        {/* Server-rendered on a fresh page: nothing for a live region to announce.
            One wording for every code better-auth can put in `?error=`; the only
            permanent one, `account_not_allowed`, is why the copy promises nothing. */}
        {error === undefined ? null : (
          <Notice className={[proseClass, 'mt-8'].join(' ')}>
            Sign-in did not go through, so you are still signed out. If the
            GitHub account you used is not the one with access, trying again
            will end the same way.
          </Notice>
        )}
        <p className="mt-10">
          <button
            aria-busy={signIn.isPending}
            className={signalButtonClass}
            onClick={startSignIn}
            type="button"
          >
            {signIn.isPending
              ? 'Opening GitHub sign-in …'
              : 'Sign in with GitHub'}
          </button>
        </p>
        {signIn.isError ? (
          <Notice className={[proseClass, 'mt-6'].join(' ')} live={true}>
            GitHub sign-in could not be started. Check your connection and try
            again.
          </Notice>
        ) : null}
        <p className="mt-10 text-ink-faint text-sm">
          Private: only the one allowed GitHub account can sign in.
        </p>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await hasAuthorizedSessionFn()) {
      throw redirect({ to: '/' });
    }
  },
  component: SignInPage,
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  validateSearch: parseOAuthErrorSearch,
});
