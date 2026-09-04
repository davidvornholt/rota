/**
 * Router-level fallbacks. TanStack Router's built-ins render an unlandmarked
 * "Not Found" string and an unthemed debug panel, so both states get a real
 * page here: one heading, a descriptive title, and a way back.
 *
 * A route's error or not-found component renders in place of that route's own
 * match. Under `_app` that place is inside the shell's <main>; for a failure
 * that never reached the shell there is no landmark yet and the fallback has
 * to open the only one. The shell says which case applies through
 * `InsideMainLandmark`.
 */

import { createContext, type ReactNode, useContext, useEffect } from 'react';

import { frameClass, inkButtonClass, proseClass } from './classes.ts';
import { pageTitle } from './page-title.ts';
import { UnmarkedLink } from './unmarked-link.tsx';

const MainLandmarkContext = createContext(false);

export const InsideMainLandmark = ({
  children,
}: {
  readonly children: ReactNode;
}) => <MainLandmarkContext value={true}>{children}</MainLandmarkContext>;

type FallbackContent = {
  readonly heading: string;
  readonly message: string;
};

const FallbackBody = ({ heading, message }: FallbackContent) => {
  // A fallback replaces a match rather than becoming one, so it cannot set the
  // title through the router; this corrects the window title once live.
  useEffect(() => {
    document.title = pageTitle(heading);
  }, [heading]);

  return (
    <section>
      <h1 className="type-display text-5xl text-ink sm:text-6xl">{heading}</h1>
      <p
        className={[
          proseClass,
          'mt-8 border-rule border-t pt-6 text-ink-muted text-lg',
        ].join(' ')}
      >
        {message}
      </p>
      <p className="mt-10">
        <UnmarkedLink
          activeProps={{ className: '' }}
          className={inkButtonClass}
          to="/"
        >
          Back to today
        </UnmarkedLink>
      </p>
    </section>
  );
};

const FallbackPage = ({ heading, message }: FallbackContent) => {
  const frame = (
    <div className={frameClass}>
      <FallbackBody heading={heading} message={message} />
    </div>
  );
  return useContext(MainLandmarkContext) ? (
    frame
  ) : (
    <main className="flex min-h-svh flex-col justify-center bg-paper py-16">
      {frame}
    </main>
  );
};

export const RouterNotFound = () => (
  <FallbackPage
    heading="Page not found"
    message="There is nothing at this address, so the link that brought you here is either old or mistyped."
  />
);

export const RouterError = () => (
  <FallbackPage
    heading="Something went wrong"
    message="This page could not be loaded. Trying again is usually enough."
  />
);
