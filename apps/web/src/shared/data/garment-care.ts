import { daysBetween, type LocalDate } from '#/shared/time/local-date.ts';
import type { Garment } from './garment.ts';
import { effectiveWearBudget, hasWearBudget } from './garment-types.ts';
import type { WearEntry } from './wear-log-repository.ts';

/** Washing resets prior wears, including today only when it was already logged. */
export const wearsSinceWash = (
  log: ReadonlyArray<WearEntry>,
  garment: Pick<Garment, 'id' | 'washedOn' | 'washedAfterWear'>,
  date: LocalDate,
): number =>
  new Set(
    log
      .filter(
        (entry) =>
          entry.garmentId === garment.id &&
          entry.wornOn < date &&
          (garment.washedOn === null ||
            entry.wornOn > garment.washedOn ||
            (entry.wornOn === garment.washedOn && !garment.washedAfterWear)),
      )
      .map((entry) => entry.wornOn),
  ).size;

export const availableToWear = (
  garment: Garment,
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
  budgets: Readonly<Record<string, number>>,
): boolean =>
  garment.status === 'active' &&
  !garment.inLaundry &&
  (!hasWearBudget(garment) ||
    wearsSinceWash(log, garment, date) < effectiveWearBudget(garment, budgets));

export const cleanTopOn = (
  date: LocalDate,
  anchor: LocalDate | null,
  override: boolean | null,
): boolean =>
  override ??
  (anchor !== null && date >= anchor && daysBetween(anchor, date) % 2 === 0);
