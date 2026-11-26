import type { GarmentView } from '#/shared/data/garment-view.ts';
import { formatDayMonth } from '#/shared/time/local-date.ts';

const wearsLeft = (garment: GarmentView) =>
  garment.effectiveBudget - garment.wearsSinceWash;

/** Worn but not yet washed, the closest to its wash first, then the most recently worn. */
export const wornSinceWashing = (
  garments: ReadonlyArray<GarmentView>,
): ReadonlyArray<GarmentView> =>
  garments
    .filter((garment) => !garment.inLaundry && garment.wearsSinceWash > 0)
    .sort(
      (left, right) =>
        wearsLeft(left) - wearsLeft(right) ||
        (right.lastWornOn ?? '').localeCompare(left.lastWornOn ?? ''),
    );

/** Such as `2 of 4 wears · last worn 22 Nov`. */
export const wearsStatus = (garment: GarmentView): string => {
  const wears = `${garment.wearsSinceWash} of ${garment.effectiveBudget} wears`;
  return garment.lastWornOn === null
    ? wears
    : `${wears} · last worn ${formatDayMonth(garment.lastWornOn)}`;
};
