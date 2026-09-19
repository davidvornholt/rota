import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { formatDayMonth } from '#/shared/time/local-date.ts';
export const careLabel = (garment: GarmentView): string => {
  if (garment.inLaundry) {
    return garment.readyOn === null
      ? 'In laundry'
      : `In laundry · back ${formatDayMonth(garment.readyOn)}`;
  }
  if (!hasWearBudget(garment)) {
    return 'Ready to wear';
  }
  if (garment.wearsSinceWash === 0) {
    return garment.assumedCleanOn === null ? 'Clean' : 'Expected clean';
  }
  return garment.wearsSinceWash >= garment.effectiveBudget
    ? 'Ready to wash'
    : `${garment.wearsSinceWash} of ${garment.effectiveBudget} wears`;
};
