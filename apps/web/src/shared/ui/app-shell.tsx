import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { type RefObject, useEffect, useId, useRef } from 'react';
import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { currentPersonFn } from '#/shared/auth/session-fn.ts';
import { frameClass, tabActiveClass, tabClass } from './classes.ts';
import { IconButton } from './icon-button.tsx';
import { IconLink } from './icon-link.tsx';
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
  const person = useQuery({
    queryKey: ['current-person'],
    queryFn: () => currentPersonFn(),
  });
  const queryClient = useQueryClient();
  const mainId = useId();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const locationPath = useRouterState({
    select: (state) => state.location.pathname,
  });
  const previousPathRef = useRef(locationPath);
  // Client navigation removes the link that held focus; move it to the new page.
  useEffect(() => {
    if (previousPathRef.current === locationPath) {
      return;
    }
    previousPathRef.current = locationPath;
    if (mainRef.current !== null) {
      focusMainAfterNavigation(mainRef.current);
    }
  }, [locationPath]);

  // A ref rather than `isPending`: two activations in one React batch would
  // both read "not pending" and fire twice.
  const signOutStartedRef: RefObject<boolean> = useRef(false);
  const signOut = useMutation({
    mutationFn: () => authClient.signOut().then(rejectAuthError),
    onSuccess: async () => {
      queryClient.clear();
      await router.invalidate();
      await router.navigate({ to: '/login' });
    },
    onSettled: () => {
      signOutStartedRef.current = false;
    },
  });
  const startSignOut = () => {
    if (signOutStartedRef.current) {
      return;
    }
    signOutStartedRef.current = true;
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
        className="flex-1 py-8 motion-safe:animate-soft-reveal sm:py-12"
        key={locationPath}
        id={mainId}
        ref={mainRef}
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
            'flex flex-wrap items-center justify-between gap-4 py-3 text-ink-faint text-sm',
          ].join(' ')}
        >
          <span>Rota</span>
          <div className="flex items-center gap-1">
            <IconLink
              icon="key"
              label="Passkeys"
              linkOptions={{ to: '/account' }}
            />
            {person.data?.admin ? (
              <IconLink
                icon="users"
                label="People"
                linkOptions={{ to: '/people' }}
              />
            ) : null}
            <IconButton
              icon="logout"
              label={signOut.isPending ? 'Signing out …' : 'Sign out'}
              pending={signOut.isPending}
              onClick={startSignOut}
            />
          </div>
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
