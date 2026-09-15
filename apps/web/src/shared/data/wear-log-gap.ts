/**
 * The silence before today in the wear log. Both the Today page's prompt and
 * the catch-up page read it, so the definition lives once, below both.
 */

import {
  addDays,
  daysInRange,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import type { WearEntry } from './wear-log-repository.ts';

/** The most recent logged day strictly before `today`, if anything was ever logged. */
export const lastLoggedDayBefore = (
  log: ReadonlyArray<WearEntry>,
  today: LocalDate,
): LocalDate | undefined => {
  let latest: LocalDate | undefined;
  for (const entry of log) {
    if (
      entry.wornOn < today &&
      (latest === undefined || entry.wornOn > latest)
    ) {
      latest = entry.wornOn;
    }
  }
  return latest;
};

/**
 * Every day after the last logged one and before today, oldest first. Empty
 * when nothing has been logged yet — a wardrobe that was never used has no
 * gap — and when yesterday was logged.
 */
export const unloggedDaysBefore = (
  log: ReadonlyArray<WearEntry>,
  today: LocalDate,
): ReadonlyArray<LocalDate> => {
  const last = lastLoggedDayBefore(log, today);
  return last === undefined
    ? []
    : daysInRange(addDays(last, 1), addDays(today, -1));
};
