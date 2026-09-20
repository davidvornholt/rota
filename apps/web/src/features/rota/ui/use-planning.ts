import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { addDays } from '#/shared/time/local-date.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { usePlanSave } from './use-plan-save.ts';
import { usePlanningMutation } from './use-planning-mutation.ts';

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
  const mutation = usePlanningMutation({
    view,
    seed,
    setView,
    setEntries,
    setBasedOn,
    setPinned,
    setMessage,
  });
  const planSave = usePlanSave((draft) =>
    mutation.mutateAsync({ action: 'plan', ...draft }),
  );
  const select = (next: ReadonlyArray<OutfitEntry>, source: string | null) => {
    setEntries(next);
    setBasedOn(source);
    setPinned((ids) =>
      ids.filter((id) => next.some((entry) => entry.garmentId === id)),
    );
    setMessage('');
    planSave.save({ entries: next, basedOn: source });
  };
  const consumedSeedRef = useRef('');
  useEffect(() => {
    if (mutation.recovering) {
      return;
    }
    const key = `${seed.garment ?? ''}:${seed.outfit ?? ''}`;
    if (consumedSeedRef.current === key) {
      return;
    }
    consumedSeedRef.current = key;
    if (initial.day.worn !== null) {
      return;
    }
    if (garment !== undefined && slot !== undefined) {
      select([{ slot, garmentId: garment.id }], null);
      setPinned([garment.id]);
    } else if (savedOutfit !== undefined) {
      select(savedOutfit.entries, savedOutfit.name);
      setPinned([]);
    }
  });
  return {
    refresh: () => {
      router.invalidate().catch(() => undefined);
    },
    view,
    entries,
    setEntries: (next: ReadonlyArray<OutfitEntry>) => select(next, basedOn),
    pinned,
    basedOn,
    message: mutation.recovering
      ? 'Checking for an ongoing suggestion …'
      : message,
    suggesting:
      mutation.isPending &&
      (mutation.variables?.action === 'suggest' ||
        mutation.variables?.action === 'resume-suggestion'),
    busy:
      mutation.recovering ||
      (mutation.isPending && mutation.variables?.action !== 'plan'),
    planSave,
    failure: mutation.variables?.action === 'plan' ? null : mutation.error,
    change: mutation.mutateAsync,
    care: (id: string, care: 'laundry' | 'washed' | 'postpone') =>
      mutation.mutateAsync({
        action: 'care',
        ids: [id],
        care,
        draft:
          care === 'laundry' && view.day.worn === null
            ? { entries, basedOn }
            : null,
      }),
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
      select(outfit.entries, outfit.name);
      setPinned([]);
    },
  };
};
export type PlanningController = ReturnType<typeof usePlanning>;
