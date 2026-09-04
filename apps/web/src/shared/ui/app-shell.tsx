import { useMutation } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { type RefObject, useEffect, useId, useRef } from 'react';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import {
  frameClass,
  linkButtonClass,
  tabActiveClass,
  tabClass,
} from './classes.ts';
import { Notice } from './notice.tsx';
import { InsideMainLandmark } from './router-fallbacks.tsx';
import { UnmarkedLink } from './unmarked-link.tsx';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/wardrobe', label: 'Wardrobe' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
] as const;

// `focus`, not `focus-visible`: the link is only reachable by keyboard, so it
// has to appear the moment it takes focus.
const skipLinkClass =
  'sr-only text-ink text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-20 focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2';

const Navigation = ({ className }: { readonly className: string }) => (
  <nav aria-label="Main" className={className}>
    <ul className="flex items-stretch justify-between gap-2 sm:justify-end sm:gap-7">
      {navItems.map((item) => (
        <li key={item.to}>
          <Link
            activeOptions={{ exact: item.to === '/' }}
            activeProps={{ className: tabActiveClass }}
            className={tabClass}
            to={item.to}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

const focusMainAfterNavigation = (target: HTMLElement): void => {
  target.focus({ preventScroll: true });
  const { bottom, top } = target.getBoundingClientRect();
  if (bottom <= 0 || top >= window.innerHeight || top < 0) {
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  }
};

export const AppShell = () => {
  const mainId = useId();
  const router = useRouter();
  const main = useRef<HTMLElement>(null);
  const locationPath = useRouterState({
    select: (state) => state.location.pathname,
  });
  const previousPath = useRef(locationPath);
  // Client navigation removes the link that held focus; move it to the new page.
  useEffect(() => {
    if (previousPath.current === locationPath) {
      return;
    }
    previousPath.current = locationPath;
    if (main.current !== null) {
      focusMainAfterNavigation(main.current);
    }
  }, [locationPath]);

  // A ref rather than `isPending`: two activations in one React batch would
  // both read "not pending" and fire twice.
  const signOutStarted: RefObject<boolean> = useRef(false);
  const signOut = useMutation({
    mutationFn: () => authClient.signOut().then(rejectAuthError),
    onSuccess: () => router.navigate({ to: '/login' }),
    onSettled: () => {
      signOutStarted.current = false;
    },
  });
  const startSignOut = () => {
    if (signOutStarted.current) {
      return;
    }
    signOutStarted.current = true;
    signOut.mutate();
  };

  return (
    <div className="relative flex min-h-svh flex-col bg-paper pb-16 sm:pb-0">
      <a className={skipLinkClass} href={`#${mainId}`}>
        Skip to content
      </a>
      <header className="border-rule border-b">
        <div
          className={[
            frameClass,
            'flex items-center justify-between gap-6 py-3',
          ].join(' ')}
        >
          <p className="type-display text-2xl text-ink">
            <UnmarkedLink activeProps={{ className: '' }} to="/">
              Rota
            </UnmarkedLink>
          </p>
          <Navigation className="hidden sm:block" />
        </div>
      </header>
      <main
        className="flex-1 py-8 sm:py-12"
        id={mainId}
        ref={main}
        tabIndex={-1}
      >
        <InsideMainLandmark>
          <Outlet />
        </InsideMainLandmark>
      </main>
      <footer className="border-rule border-t">
        <div
          className={[
            frameClass,
            'flex items-center justify-between py-5 text-ink-faint text-sm',
          ].join(' ')}
        >
          <span>Rota · a garment rota for one</span>
          <button
            aria-busy={signOut.isPending}
            className={linkButtonClass}
            onClick={startSignOut}
            type="button"
          >
            {signOut.isPending ? 'Signing out …' : 'Sign out'}
          </button>
        </div>
        {signOut.isError ? (
          <div className={[frameClass, 'pb-5'].join(' ')}>
            <Notice live={true}>
              Sign-out failed. You are still signed in; check your connection
              and try again.
            </Notice>
          </div>
        ) : null}
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-10 border-rule border-t bg-paper sm:hidden">
        <Navigation className="px-3" />
      </div>
    </div>
  );
};
