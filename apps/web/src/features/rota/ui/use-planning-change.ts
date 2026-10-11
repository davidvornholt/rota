import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { changePlanningFn } from '../services/planning-fns.ts';

/**
 * Applies planning changes from a page that keeps no outfit draft, such as
 * saved outfits or laundry. Unlike Today it neither autosaves a plan nor
 * resumes a running suggestion.
 */
export const usePlanningChange = (initial: PlanningView) => {
  const router = useRouter();
  const [view, setView] = useState(initial);
  useEffect(() => {
    setView(initial);
  }, [initial]);
  const mutation = useMutation({
    mutationFn: (change: PlanningChange) =>
      changePlanningFn({
        data: { date: view.day.today, change },
        fetch: serverFunctionFetch,
      }),
    onSuccess: async (next) => {
      setView(next);
      // Today keeps the outfit it mounts with, so it must not reopen from a
      // cached, older day. Other loaders can refresh in the background.
      router.clearCache({ filter: (match) => match.pathname === '/' });
      await router.invalidate().catch(() => undefined);
    },
  });
  return { view, busy: mutation.isPending, change: mutation.mutateAsync };
};
