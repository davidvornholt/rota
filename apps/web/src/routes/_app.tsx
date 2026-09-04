import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import { AppShell } from '#/shared/ui/app-shell.tsx';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    if (!(await hasAuthorizedSessionFn())) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppShell,
});
