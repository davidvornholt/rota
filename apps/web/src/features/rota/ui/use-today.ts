import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type {
  ProposalItemView,
  TodayView,
  UnloggedDay,
} from '../schemas/today-view.ts';
import {
  backfillFn,
  confirmProposalFn,
  decideTodayFn,
  logOutfitFn,
  rerollProposalFn,
  saveOccasionFn,
} from '../services/today-fns.ts';

export type Draft = Partial<Record<Slot, ProposalItemView>>;
export type RerollScope = 'boundary' | 'all';

const draftOf = (items: ReadonlyArray<ProposalItemView>): Draft =>
  Object.fromEntries(items.map((item) => [item.slot, item])) as Draft;

const sameOutfit = (
  draft: Draft,
  items: ReadonlyArray<ProposalItemView>,
): boolean =>
  slotOrder.every(
    (slot) =>
      draft[slot]?.garment.id ===
      items.find((item) => item.slot === slot)?.garment.id,
  );

/** The outfit as the wearer is shaping it: the proposal's items until a swap or removal. */
const useOutfitDraft = (proposal: TodayView['proposal']) => {
  const [draft, setDraft] = useState<Draft>(() =>
    draftOf(proposal?.items ?? []),
  );
  const reset = useCallback(
    (next: TodayView['proposal']) => setDraft(draftOf(next?.items ?? [])),
    [],
  );
  const items = slotOrder.flatMap((slot) => {
    const item = draft[slot];
    return item === undefined ? [] : [item];
  });
  const pick = (slot: Slot, garment: GarmentView) =>
    setDraft((current) => ({
      ...current,
      [slot]: {
        slot,
        garment,
        continued: false,
        dayOfBudget: 1,
        budget: garment.effectiveBudget,
        reason: 'Your pick.',
      },
    }));
  const remove = (slot: Slot) =>
    setDraft((current) => {
      const { [slot]: _removed, ...rest } = current;
      return rest;
    });
  return {
    items,
    edited: proposal !== null && !sameOutfit(draft, proposal.items),
    reset,
    pick,
    remove,
  };
};

/** The server calls that move the day; each answers with the fresh view. */
const useTodayMutations = (
  today: TodayView['today'],
  apply: (next: TodayView) => void,
  applyLogged: (next: TodayView) => void,
) => ({
  decide: useMutation({ mutationFn: () => decideTodayFn(), onSuccess: apply }),
  confirm: useMutation({
    mutationFn: (id: string) => confirmProposalFn({ data: { id } }),
    onSuccess: applyLogged,
  }),
  wearDraft: useMutation({
    mutationFn: (entries: ReadonlyArray<{ garmentId: string; slot: Slot }>) =>
      logOutfitFn({ data: { date: today, entries, source: 'override' } }),
    onSuccess: applyLogged,
  }),
  reroll: useMutation({
    mutationFn: (input: { id: string; scope: RerollScope }) =>
      rerollProposalFn({ data: input }),
    onSuccess: apply,
  }),
  occasion: useMutation({
    mutationFn: (text: string) => saveOccasionFn({ data: { occasion: text } }),
    onSuccess: apply,
  }),
  backfill: useMutation({
    mutationFn: (day: UnloggedDay) =>
      backfillFn({ data: { date: day.date, copyFrom: day.previousDate } }),
    onSuccess: apply,
  }),
});

/**
 * The Today page's state and actions in one place: the server's view, the
 * outfit as the wearer has edited it, and the mutations that move the day.
 * The loader's payload always wins when it arrives; a mutation's answer is
 * shown at once and the loader asked to catch up.
 */
export const useToday = (initial: TodayView) => {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const outfit = useOutfitDraft(initial.proposal);
  const [justLogged, setJustLogged] = useState(false);
  const decisionAsked = useRef(false);

  const { reset } = outfit;
  useEffect(() => {
    setView(initial);
    reset(initial.proposal);
  }, [initial, reset]);

  const apply = (next: TodayView) => {
    setView(next);
    reset(next.proposal);
    router.invalidate().catch(() => undefined);
  };
  const applyLogged = (next: TodayView) => {
    setJustLogged(true);
    apply(next);
  };
  const { decide, confirm, wearDraft, reroll, occasion, backfill } =
    useTodayMutations(view.today, apply, applyLogged);

  const needsDecision =
    view.proposal === null &&
    view.worn === null &&
    view.problem === null &&
    view.activeGarments > 0;
  useEffect(() => {
    if (needsDecision && !decisionAsked.current) {
      decisionAsked.current = true;
      decide.mutate();
    }
  }, [needsDecision, decide]);

  const { proposal } = view;
  const mutations = [confirm, wearDraft, reroll, decide, occasion, backfill];

  const wear = () => {
    if (proposal === null) {
      return;
    }
    if (outfit.edited) {
      wearDraft.mutate(
        outfit.items.map((item) => ({
          garmentId: item.garment.id,
          slot: item.slot,
        })),
      );
    } else {
      confirm.mutate(proposal.id);
    }
  };

  return {
    view,
    draftItems: outfit.items,
    edited: outfit.edited,
    justLogged,
    needsDecision,
    deciding: decide.isPending,
    rerolling: reroll.isPending,
    logging: confirm.isPending || wearDraft.isPending,
    busy: mutations.some((mutation) => mutation.isPending),
    failure: mutations.find((mutation) => mutation.isError)?.error,
    decide: () => decide.mutate(),
    wear,
    reroll: (scope: RerollScope) => {
      if (proposal !== null) {
        reroll.mutate({ id: proposal.id, scope });
      }
    },
    pick: outfit.pick,
    remove: outfit.remove,
    saveOccasion: (text: string) => occasion.mutate(text),
    savingOccasion: occasion.isPending,
    backfill: (day: UnloggedDay) => backfill.mutate(day),
    backfilling: backfill.isPending,
  };
};

export type TodayController = ReturnType<typeof useToday>;
