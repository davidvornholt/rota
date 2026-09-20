// biome-ignore lint/suspicious/noDeprecatedImports: Only useBlocker's positional overload is deprecated; this hook uses the supported options object.
import { useBlocker } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';

type Draft = {
  readonly entries: ReadonlyArray<OutfitEntry>;
  readonly basedOn: string | null;
};

/** Keep edits visible while ordered writes finish, including across navigation. */
export const usePlanSave = (persist: (draft: Draft) => Promise<unknown>) => {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const latestRef = useRef<Draft | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);
  const unsavedRef = useRef(false);

  const save = (draft: Draft) => {
    latestRef.current = draft;
    unsavedRef.current = true;
    setSaving(true);
    setFailed(false);
    const work = persist(draft)
      .then(() => {
        if (latestRef.current === draft) {
          unsavedRef.current = false;
        }
      })
      .catch(() => {
        if (latestRef.current === draft) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (latestRef.current === draft) {
          pendingRef.current = null;
          setSaving(false);
        }
      });
    pendingRef.current = work;
  };

  const blocker = useBlocker({
    withResolver: true,
    enableBeforeUnload: () => unsavedRef.current,
    shouldBlockFn: async () => {
      while (pendingRef.current !== null) {
        // biome-ignore lint/performance/noAwaitInLoops: New edits can queue while navigation waits; every pending write must settle before leaving.
        await pendingRef.current;
      }
      return unsavedRef.current;
    },
  });

  return {
    blocker,
    saving,
    failed,
    save,
    retry: () => {
      if (latestRef.current !== null) {
        save({ ...latestRef.current });
      }
    },
  };
};
