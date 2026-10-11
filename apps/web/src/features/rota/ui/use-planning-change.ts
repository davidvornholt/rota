import { useMutation } from '@tanstack/react-query';
// biome-ignore lint/suspicious/noDeprecatedImports: Only useBlocker's positional overload is deprecated; this hook uses the supported options object.
import { useBlocker, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
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
  const pendingRef = useRef<Promise<PlanningView> | null>(null);
  useEffect(() => {
    setView(initial);
  }, [initial]);
  const mutation = useMutation({
    mutationFn: (input: PlanningChange) =>
      changePlanningFn({
        data: { date: view.day.today, change: input },
        fetch: serverFunctionFetch,
      }),
    onSuccess: async (next) => {
      setView(next);
      // Today keeps the outfit it mounts with, so it must not reopen from a
      // cached, older day.
      router.clearCache({ filter: (match) => match.pathname === '/' });
      await router.invalidate();
    },
  });
  useBlocker({
    enableBeforeUnload: () => pendingRef.current !== null,
    shouldBlockFn: async () => {
      try {
        // mutateAsync includes onSuccess, so Today mounts only after its
        // cached plan is cleared and the active loaders have refreshed.
        await pendingRef.current;
        return false;
      } catch {
        // Keep the originating page mounted to show its mutation error.
        return true;
      }
    },
  });
  const change = (input: PlanningChange) => {
    const pending = mutation.mutateAsync(input);
    pendingRef.current = pending;
    return pending.finally(() => {
      if (pendingRef.current === pending) {
        pendingRef.current = null;
      }
    });
  };
  return { view, busy: mutation.isPending, change };
};
