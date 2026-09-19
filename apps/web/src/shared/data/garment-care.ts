import {
  addDays,
  daysBetween,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import type { Garment } from './garment.ts';
import { effectiveWearBudget, hasWearBudget } from './garment-types.ts';
import type { WearEntry } from './wear-log-repository.ts';

export type GarmentCare = {
  readonly wearsSinceWash: number;
  readonly inLaundry: boolean;
  readonly readyOn: LocalDate | null;
  readonly assumedCleanOn: LocalDate | null;
};
type CareGarment = Pick<
  Garment,
  | 'id'
  | 'category'
  | 'wearBudget'
  | 'washedOn'
  | 'washedAfterWear'
  | 'laundryStartedOn'
  | 'laundryReadyOn'
>;

export type CareSettings = {
  readonly categoryBudgets: Readonly<Record<string, number>>;
  readonly laundryDays: number;
};

/** Replay wears so corrections, backfills and tomorrow's preview share one cycle. */
export const careFromDates = (
  garment: CareGarment,
  dates: ReadonlyArray<LocalDate>,
  date: LocalDate,
  settings: CareSettings,
): GarmentCare => {
  const manualReturn = garment.laundryReadyOn;
  const returned = manualReturn !== null && manualReturn <= date;
  const worn = [...new Set(dates)]
    .filter(
      (day) =>
        day <= date &&
        (garment.washedOn === null ||
          day > garment.washedOn ||
          (day === garment.washedOn && !garment.washedAfterWear)) &&
        (!returned || day >= manualReturn),
    )
    .sort((left, right) => left.localeCompare(right));
  const budget = effectiveWearBudget(garment, settings.categoryBudgets);
  let wears = 0;
  let readyOn: LocalDate | null = null;
  let assumedCleanOn: LocalDate | null = returned ? manualReturn : null;
  for (const day of worn) {
    if (readyOn !== null && day >= readyOn) {
      assumedCleanOn = readyOn;
      readyOn = null;
      wears = 0;
    }
    wears += 1;
    if (hasWearBudget(garment) && wears >= budget && readyOn === null) {
      readyOn = addDays(day, settings.laundryDays);
    }
  }
  if (readyOn !== null && date >= readyOn) {
    assumedCleanOn = readyOn;
    readyOn = null;
    wears = 0;
  }
  if (
    garment.laundryStartedOn !== null &&
    garment.laundryStartedOn <= date &&
    manualReturn !== null &&
    manualReturn > date
  ) {
    readyOn = manualReturn;
  }
  return {
    wearsSinceWash: wears,
    inLaundry: readyOn !== null,
    readyOn,
    assumedCleanOn,
  };
};

export const garmentCare = (
  garment: CareGarment,
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
  settings: CareSettings,
): GarmentCare =>
  careFromDates(
    garment,
    log
      .filter((entry) => entry.garmentId === garment.id)
      .map((entry) => entry.wornOn),
    date,
    settings,
  );

export const availableToWear = (
  garment: Garment,
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
  settings: CareSettings,
): boolean =>
  garment.status === 'active' &&
  !garmentCare(garment, log, date, settings).inLaundry;

export const cleanTopOn = (
  date: LocalDate,
  anchor: LocalDate | null,
  override: boolean | null,
): boolean =>
  override ??
  (anchor !== null && date >= anchor && daysBetween(anchor, date) % 2 === 0);
