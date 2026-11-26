import type { GarmentView } from '#/shared/data/garment-view.ts';
import {
  addDays,
  formatDayMonth,
  type LocalDate,
} from '#/shared/time/local-date.ts';

const recentReturnDays = 7;

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

/**
 * Pieces Rota counted as back from the wash in the last week, unworn since,
 * so a piece that is still in the basket can be held back.
 */
export const backFromLaundry = (
  garments: ReadonlyArray<GarmentView>,
  today: LocalDate,
): ReadonlyArray<GarmentView & { readonly assumedCleanOn: LocalDate }> =>
  garments.filter(
    (
      garment,
    ): garment is GarmentView & { readonly assumedCleanOn: LocalDate } =>
      !garment.inLaundry &&
      garment.wearsSinceWash === 0 &&
      garment.assumedCleanOn !== null &&
      garment.assumedCleanOn >= addDays(today, -recentReturnDays),
  );
