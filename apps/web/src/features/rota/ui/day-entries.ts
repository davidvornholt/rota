import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { PlanningView } from '../schemas/planning-view.ts';

/** The day's outfit: what was worn, else the saved plan, else the suggestion. */
export const dayEntries = (view: PlanningView): ReadonlyArray<OutfitEntry> =>
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
