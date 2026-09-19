import { useEffect, useRef, useState } from 'react';
import type { PlanningController } from './use-planning.ts';

/** Respond immediately and serialize writes so rapid toggles cannot finish out of order. */
export const useCleanTop = (controller: PlanningController) => {
  const [value, setValue] = useState(controller.view.cleanTop);
  const [saving, setSaving] = useState(false);
  const desiredRef = useRef(value);
  const confirmedRef = useRef(value);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!runningRef.current) {
      confirmedRef.current = controller.view.cleanTop;
      desiredRef.current = controller.view.cleanTop;
      setValue(controller.view.cleanTop);
    }
  }, [controller.view.cleanTop]);

  const set = (next: boolean) => {
    desiredRef.current = next;
    setValue(next);
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    setSaving(true);
    const persist = async () => {
      try {
        while (desiredRef.current !== confirmedRef.current) {
          const target = desiredRef.current;
          // biome-ignore lint/performance/noAwaitInLoops: Preference writes must finish in order; parallel writes could persist an older toggle.
          await controller.change({ action: 'clean-top', value: target });
          confirmedRef.current = target;
        }
      } catch {
        // The planning controller presents the error; restore the last confirmed choice.
        desiredRef.current = confirmedRef.current;
        setValue(confirmedRef.current);
      } finally {
        runningRef.current = false;
        setSaving(false);
      }
    };
    persist().catch(() => undefined);
  };
  return { value, saving, set };
};
