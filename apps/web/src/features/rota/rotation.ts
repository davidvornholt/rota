/**
 * The rotation engine: everything about what to wear that does not need a
 * model. It reads the wear log, identifies continuing garments, and offers
 * available alternatives. Weather and outfit suitability belong to Gemini.
 */

import type { Garment } from '#/shared/data/garment.ts';
import {
  effectiveWearBudget,
  type Slot,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { daysBetween, type LocalDate } from '#/shared/time/local-date.ts';

export type Outfit = Partial<Readonly<Record<Slot, string>>>;

/** The garment per slot worn on one day, from the log. */
export const outfitOn = (
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
): Outfit => {
  const outfit: Partial<Record<Slot, string>> = {};
  for (const entry of log) {
    if (entry.wornOn === date) {
      outfit[entry.slot] = entry.garmentId;
    }
  }
  return outfit;
};

const distinctDaysBefore = (
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
): ReadonlyArray<LocalDate> =>
  [
    ...new Set(
      log.filter((entry) => entry.wornOn < date).map((entry) => entry.wornOn),
    ),
  ].sort((left, right) => (left < right ? 1 : -1));

/**
 * An unlogged day or two does not end a rotation: you wore the trousers, you
 * just did not say so. A longer silence does — after a week away nothing from
 * before it is "still on".
 */
export const maximumGapDays = 3;

/** The most recent logged day before `date`, if it is recent enough to still be in rotation. */
export const previousLoggedDay = (
  log: ReadonlyArray<WearEntry>,
  date: LocalDate,
): LocalDate | undefined => {
  const [latest] = distinctDaysBefore(log, date);
  return latest !== undefined && daysBetween(latest, date) <= maximumGapDays
    ? latest
    : undefined;
};

/**
 * How many days in a row the garment has been worn up to the day before
 * `date`, walking back over logged days only and stopping at the first logged
 * day it was absent from — or at a silence longer than the gap allowance.
 */
export const consecutiveWears = (
  log: ReadonlyArray<WearEntry>,
  garmentId: string,
  date: LocalDate,
): number => {
  let count = 0;
  let cursor = date;
  for (const day of distinctDaysBefore(log, date)) {
    if (daysBetween(day, cursor) > maximumGapDays) {
      break;
    }
    const worn = log.some(
      (entry) => entry.wornOn === day && entry.garmentId === garmentId,
    );
    if (!worn) {
      break;
    }
    count += 1;
    cursor = day;
  }
  return count;
};

/** Days since the garment was last worn before `date`; null if never. */
export const daysSinceWorn = (
  log: ReadonlyArray<WearEntry>,
  garmentId: string,
  date: LocalDate,
): number | null => {
  let latest: LocalDate | undefined;
  for (const entry of log) {
    if (
      entry.garmentId === garmentId &&
      entry.wornOn < date &&
      (latest === undefined || entry.wornOn > latest)
    ) {
      latest = entry.wornOn;
    }
  }
  return latest === undefined ? null : daysBetween(latest, date);
};

export type RotationSettings = {
  readonly cooldownDays: number;
  readonly categoryBudgets: Readonly<Record<string, number>>;
};

export type Continuation = {
  readonly slot: Slot;
  readonly garment: Garment;
  /** Which day of the budget today would be. */
  readonly dayOfBudget: number;
  readonly budget: number;
};

export type RotationInput = {
  readonly today: LocalDate;
  readonly log: ReadonlyArray<WearEntry>;
  readonly garments: ReadonlyArray<Garment>;
  readonly settings: RotationSettings;
  /** Garments this proposal must not use (today's rejections). */
  readonly excluded: ReadonlySet<string>;
};

const activeById = (garments: ReadonlyArray<Garment>) =>
  new Map(
    garments
      .filter((garment) => garment.status === 'active')
      .map((garment) => [garment.id, garment] as const),
  );

/** Yesterday's garments that still have budget left and are not excluded. */
export const continuations = (
  input: RotationInput,
): ReadonlyArray<Continuation> => {
  const previous = previousLoggedDay(input.log, input.today);
  if (previous === undefined) {
    return [];
  }
  const active = activeById(input.garments);
  const outfit = outfitOn(input.log, previous);
  return slotOrder.flatMap((slot) => {
    const id = outfit[slot];
    const garment = id === undefined ? undefined : active.get(id);
    if (garment === undefined || input.excluded.has(garment.id)) {
      return [];
    }
    const budget = effectiveWearBudget(garment, input.settings.categoryBudgets);
    const worn = consecutiveWears(input.log, garment.id, input.today);
    if (worn >= budget) {
      return [];
    }
    return [
      {
        slot,
        garment,
        dayOfBudget: worn + 1,
        budget,
      },
    ];
  });
};

export type Candidate = {
  readonly garment: Garment;
  readonly daysSinceWorn: number | null;
  /** Worn more recently than the cooldown allows; offered only when nothing else is. */
  readonly inCooldown: boolean;
};

const compareCandidates = (left: Candidate, right: Candidate): number => {
  if (left.inCooldown !== right.inCooldown) {
    return left.inCooldown ? 1 : -1;
  }
  const leftRest = left.daysSinceWorn ?? Number.POSITIVE_INFINITY;
  const rightRest = right.daysSinceWorn ?? Number.POSITIVE_INFINITY;
  return rightRest - leftRest;
};

/** Available garments for a slot, rested first; cooldown is a fallback when none are rested. */
export const candidatesFor = (
  input: RotationInput,
  slot: Slot,
  alreadyChosen: ReadonlySet<string>,
): ReadonlyArray<Candidate> => {
  const all = input.garments.flatMap((garment): ReadonlyArray<Candidate> => {
    if (
      garment.status !== 'active' ||
      !garment.slots.includes(slot) ||
      input.excluded.has(garment.id) ||
      alreadyChosen.has(garment.id)
    ) {
      return [];
    }
    const rest = daysSinceWorn(input.log, garment.id, input.today);
    return [
      {
        garment,
        daysSinceWorn: rest,
        inCooldown: rest !== null && rest < input.settings.cooldownDays,
      },
    ];
  });
  const rested = all.filter((candidate) => !candidate.inCooldown);
  const pool = rested.length > 0 ? rested : all;
  return [...pool].sort(compareCandidates);
};
