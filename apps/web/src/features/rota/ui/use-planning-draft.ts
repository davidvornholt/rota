import { type SetStateAction, useEffect, useRef, useState } from 'react';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { dayEntries } from './day-entries.ts';

/**
 * The router can show a cached Today and reload it in the background. Until
 * the person changes the outfit here, the draft follows the reloaded plan, so
 * "Wear this" can't log an older outfit over a plan made elsewhere. After a
 * change it stays, because a reload that started before the change is older
 * than it. A starting piece or outfit from the link and keeping a piece for
 * the next suggestion count as changes.
 */
export const usePlanningDraft = (
  initial: PlanningView,
  seed: {
    readonly garment: string | undefined;
    readonly outfit: string | undefined;
  },
) => {
  const garment = initial.wardrobe.find((item) => item.id === seed.garment);
  const savedOutfit = initial.outfits.find((item) => item.id === seed.outfit);
  const slot = garment?.slots[0];
  const start =
    initial.day.worn === null && garment !== undefined && slot !== undefined
      ? [{ slot, garmentId: garment.id }]
      : undefined;
  const seeded =
    initial.day.worn === null &&
    (start !== undefined || savedOutfit !== undefined);
  const [entries, setEntries] = useState<ReadonlyArray<OutfitEntry>>(
    () =>
      start ??
      (seeded ? savedOutfit?.entries : undefined) ??
      dayEntries(initial),
  );
  const [basedOn, setBasedOn] = useState<string | null>(
    savedOutfit?.name ?? initial.plan.basedOn,
  );
  const touchedRef = useRef(seeded);
  const loadedRef = useRef(initial);
  useEffect(() => {
    if (loadedRef.current !== initial && !touchedRef.current) {
      setEntries(dayEntries(initial));
      setBasedOn(initial.plan.basedOn);
    }
    loadedRef.current = initial;
  }, [initial]);
  return {
    garment,
    savedOutfit,
    slot,
    entries,
    setEntries: (next: SetStateAction<ReadonlyArray<OutfitEntry>>) => {
      touchedRef.current = true;
      setEntries(next);
    },
    basedOn,
    setBasedOn,
    markChanged: () => {
      touchedRef.current = true;
    },
  };
};
