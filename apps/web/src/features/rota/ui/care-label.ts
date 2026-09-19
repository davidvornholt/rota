import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
export const careLabel = (garment: GarmentView): string => {
  if (garment.inLaundry) {
    return 'In the laundry';
  }
  if (!hasWearBudget(garment)) {
    return 'Ready to wear';
  }
  if (garment.wearsSinceWash === 0) {
    return 'Clean';
  }
  return garment.wearsSinceWash >= garment.effectiveBudget
    ? 'Ready to wash'
    : `${garment.wearsSinceWash} of ${garment.effectiveBudget} wears`;
};
