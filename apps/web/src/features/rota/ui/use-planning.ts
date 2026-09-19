import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import { addDays } from '#/shared/time/local-date.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { changePlanningFn } from '../services/planning-fns.ts';

const initialEntries = (view: PlanningView): ReadonlyArray<OutfitEntry> =>
  view.day.worn?.map((item) => ({
    slot: item.slot,
    garmentId: item.garment.id,
  })) ??
  view.plan.entries ??
  view.day.proposal?.items.map((item) => ({
    slot: item.slot,
    garmentId: item.garment.id,
  })) ??
  [];
export const sameEntries = (
  a: ReadonlyArray<OutfitEntry>,
  b: ReadonlyArray<OutfitEntry>,
): boolean =>
  a.length === b.length &&
  a.every((entry) =>
    b.some(
      (other) =>
        other.slot === entry.slot && other.garmentId === entry.garmentId,
    ),
  );

const successMessage = (change: PlanningChange): string => {
  switch (change.action) {
    case 'suggest':
      return 'Outfit suggested. Your kept pieces stay.';
    case 'plan':
      return 'Outfit saved.';
    case 'wear':
      return 'Outfit logged.';
    case 'save-outfit':
      return 'Saved to your outfits.';
    case 'care':
      return change.care === 'washed' ? 'Back clean.' : 'Return date updated.';
    default:
      return 'Saved.';
  }
};

export const usePlanning = (
  initial: PlanningView,
  seed: {
    readonly garment: string | undefined;
    readonly outfit: string | undefined;
  },
) => {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const garment = initial.wardrobe.find((item) => item.id === seed.garment);
  const savedOutfit = initial.outfits.find((item) => item.id === seed.outfit);
  const slot = garment?.slots[0];
  const [entries, setEntries] = useState<ReadonlyArray<OutfitEntry>>(() => {
    if (initial.day.worn !== null) {
      return initialEntries(initial);
    }
    return garment !== undefined && slot !== undefined
      ? [{ slot, garmentId: garment.id }]
      : (savedOutfit?.entries ?? initialEntries(initial));
  });
  const [pinned, setPinned] = useState<ReadonlyArray<string>>(
    seed.garment === undefined ? [] : [seed.garment],
  );
  const [basedOn, setBasedOn] = useState<string | null>(
    savedOutfit?.name ?? initial.plan.basedOn,
  );
  const [message, setMessage] = useState('');
  useEffect(() => {
    setView(initial);
  }, [initial]);
  const mutation = useMutation({
    mutationFn: (change: PlanningChange) =>
      changePlanningFn({
        data: { date: view.day.today, change },
        fetch: serverFunctionFetch,
      }),
    onSuccess: async (next, change) => {
      setView(next);
      if (change.action === 'suggest') {
        setEntries(
          next.day.proposal?.items.map((item) => ({
            slot: item.slot,
            garmentId: item.garment.id,
          })) ?? [],
        );
      }
      setMessage(successMessage(change));
      try {
        const savedDay = change.action === 'plan' || change.action === 'wear';
        if (
          savedDay &&
          (seed.garment !== undefined || seed.outfit !== undefined)
        ) {
          // A consumed seed must not remount from an older cached outfit.
          router.clearCache({ filter: (match) => match.pathname === '/' });
          await router.navigate({
            to: '/',
            search: { date: next.day.today },
            replace: true,
          });
        } else {
          await router.invalidate({ sync: true });
        }
      } catch {
        setMessage('Saved. Refresh to see your outfit.');
      }
    },
  });
  return {
    refresh: () => {
      router.invalidate().catch(() => undefined);
    },
    view,
    entries,
    setEntries,
    pinned,
    basedOn,
    setBasedOn,
    message,
    busy: mutation.isPending,
    failure: mutation.error,
    change: mutation.mutateAsync,
    pin: (id: string) =>
      setPinned((ids) =>
        ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
      ),
    chooseOutfit: (outfit: SavedOutfit) => {
      if (view.day.worn !== null) {
        router
          .navigate({
            to: '/',
            search: { date: addDays(view.actualToday, 1), outfit: outfit.id },
          })
          .catch(() => setMessage('Could not open tomorrow. Try again.'));
        return;
      }
      setEntries(outfit.entries);
      setPinned([]);
      setBasedOn(outfit.name);
      setMessage('');
    },
  };
};
export type PlanningController = ReturnType<typeof usePlanning>;
