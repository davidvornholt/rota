import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { PlanningController } from './use-planning.ts';
import { sameEntries } from './use-planning.ts';

export const completeOutfit = (entries: ReadonlyArray<OutfitEntry>): boolean =>
  entries.some((entry) => entry.slot === 'top') &&
  entries.some((entry) => entry.slot === 'bottom');
const concernFor = (
  slot: OutfitEntry['slot'],
  garment: GarmentView,
  cleanTop: boolean,
): ReadonlyArray<string> => {
  if (
    hasWearBudget(garment) &&
    garment.wearsSinceWash >= garment.effectiveBudget
  ) {
    return [`${garment.name} is ready to wash.`];
  }
  if (slot === 'top' && cleanTop && garment.wearsSinceWash > 0) {
    return [`${garment.name} has been worn since washing.`];
  }
  if (slot === 'top' && garment.daysSinceWorn === 1) {
    return [`${garment.name} repeats yesterday’s top.`];
  }
  return [];
};
const availabilityMessage = (
  selected: ReadonlyArray<GarmentView>,
  expected: number,
  actual: ReadonlyArray<GarmentView>,
): string | null => {
  if (selected.length !== expected) {
    return 'A saved piece is no longer available. Choose a replacement.';
  }
  if (
    selected.some(
      (garment) =>
        garment.inLaundry &&
        !actual.find((item) => item.id === garment.id)?.inLaundry,
    )
  ) {
    return 'A piece will need washing after today’s planned wear. Choose another for tomorrow.';
  }
  return selected.some((garment) => garment.inLaundry)
    ? 'A piece is in the laundry. Choose another, or mark it back clean in Laundry.'
    : null;
};

export const draftStatus = ({
  view,
  entries,
  pinned,
  busy,
}: PlanningController) => {
  const tomorrow = view.day.today > view.actualToday;
  const selected = entries.flatMap((entry) => {
    const garment = view.wardrobe.find((item) => item.id === entry.garmentId);
    return garment === undefined ? [] : [{ ...entry, garment }];
  });
  const unavailableMessage = availabilityMessage(
    selected.map(({ garment }) => garment),
    entries.length,
    view.laundry,
  );
  const unavailable = unavailableMessage !== null;
  const concerns = unavailable
    ? []
    : selected.flatMap(({ slot, garment }) =>
        concernFor(slot, garment, view.cleanTop),
      );
  const saved =
    view.plan.entries !== null && sameEntries(entries, view.plan.entries);
  let suggestLabel = 'Suggest another';
  if (pinned.length > 0) {
    suggestLabel = 'Complete outfit';
  }
  if (entries.length === 0) {
    suggestLabel = 'Suggest an outfit';
  }
  if (busy) {
    suggestLabel = 'One moment …';
  }
  const saveLabel = saved ? 'Saved for tomorrow' : 'Save for tomorrow';
  return {
    tomorrow,
    complete: completeOutfit(entries),
    unavailable,
    unavailableMessage,
    concerns,
    saved,
    suggestLabel,
    primaryLabel: tomorrow ? saveLabel : 'Wear this',
  };
};
