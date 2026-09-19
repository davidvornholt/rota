import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { DayPlan, SavedOutfit } from '#/shared/data/outfit-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { TodayView } from './today-view.ts';
export type PlanningView = {
  readonly day: TodayView;
  readonly actualToday: LocalDate;
  readonly plan: DayPlan;
  readonly cleanTop: boolean;
  readonly laundryDays: number;
  readonly laundry: ReadonlyArray<GarmentView>;
  readonly wardrobe: ReadonlyArray<GarmentView>;
  readonly outfits: ReadonlyArray<SavedOutfit>;
  readonly warnings: ReadonlyArray<string>;
};
