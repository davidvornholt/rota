import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { SavedOutfit } from '#/shared/data/outfit-repository.ts';
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
  const [entries, setEntries] = useState<ReadonlyArray<OutfitEntry>>(() =>
    garment !== undefined && slot !== undefined
      ? [{ slot, garmentId: garment.id }]
      : (savedOutfit?.entries ?? initialEntries(initial)),
  );
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
    onSuccess: (next, change) => {
      setView(next);
      if (change.action === 'suggest') {
        setEntries(
          next.day.proposal?.items.map((item) => ({
            slot: item.slot,
            garmentId: item.garment.id,
          })) ?? [],
        );
        setMessage('Outfit suggested. Your kept pieces stay.');
      } else if (change.action === 'plan') {
        setMessage('Outfit saved.');
      } else if (change.action === 'wear') {
        setMessage('Outfit logged.');
      } else if (change.action === 'save-outfit') {
        setMessage('Saved to your outfits.');
      } else if (change.action === 'care') {
        setMessage(
          change.care === 'washed' ? 'Marked washed.' : 'Moved to laundry.',
        );
      } else {
        setMessage('Saved.');
      }
      router.invalidate().catch(() => undefined);
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
