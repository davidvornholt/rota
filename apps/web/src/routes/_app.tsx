import { createFileRoute, redirect } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';

import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import { AppShell } from '#/shared/ui/app-shell.tsx';

// The server renders a signed-in page only for an authorized session. In the
// browser, every server function checks the session itself and a 401 sends
// the tab to sign in (`signedInFetch`), so a tap on a tab doesn't wait for a
// separate session check first.
const requireSession = createIsomorphicFn()
  .server(async () => {
    if (!(await hasAuthorizedSessionFn())) {
      throw redirect({ to: '/login' });
    }
  })
  .client(() => undefined);

export const Route = createFileRoute('/_app')({
  beforeLoad: () => requireSession(),
  component: AppShell,
});
