/**
 * The rotation engine: everything about what to wear that does not need a
 * model. It reads the wear log, identifies continuing garments, and offers
 * available alternatives. Weather and outfit suitability belong to Gemini.
 */

import type { Garment } from '#/shared/data/garment.ts';
import { availableToWear, wearsSinceWash } from '#/shared/data/garment-care.ts';
import {
  effectiveWearBudget,
  hasWearBudget,
  type Slot,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import {
  addDays,
  daysBetween,
  type LocalDate,
} from '#/shared/time/local-date.ts';

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
  readonly cleanTop: boolean;
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
    if (
      slot === 'top' ||
      garment === undefined ||
      !hasWearBudget(garment) ||
      input.excluded.has(garment.id) ||
      !availableToWear(
        garment,
        input.log,
        input.today,
        input.settings.categoryBudgets,
      )
    ) {
      return [];
    }
    const budget = effectiveWearBudget(garment, input.settings.categoryBudgets);
    const worn = wearsSinceWash(input.log, garment, input.today);
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
  readonly wearsSinceWash: number;
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
      !availableToWear(
        garment,
        input.log,
        input.today,
        input.settings.categoryBudgets,
      ) ||
      (slot === 'top' &&
        input.cleanTop &&
        wearsSinceWash(input.log, garment, input.today) > 0) ||
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
        wearsSinceWash: wearsSinceWash(input.log, garment, input.today),
        daysSinceWorn: rest,
        inCooldown:
          hasWearBudget(garment) &&
          rest !== null &&
          rest < input.settings.cooldownDays,
      },
    ];
  });
  // Daily top variety is a hard suggestion constraint; explicit manual picks may override it.
  const previous = outfitOn(input.log, addDays(input.today, -1)).top;
  const varied =
    slot === 'top'
      ? all.filter((candidate) => candidate.garment.id !== previous)
      : all;
  const rested = varied.filter((candidate) => !candidate.inCooldown);
  // Between clean-top days, keep partly worn tops in play even when the
  // style cooldown prefers a less recent piece. Rest does not mean washing.
  const reusable =
    slot === 'top' && !input.cleanTop
      ? varied.filter((candidate) => candidate.wearsSinceWash > 0)
      : [];
  const pool =
    rested.length > 0
      ? [
          ...new Map(
            [...reusable, ...rested].map((candidate) => [
              candidate.garment.id,
              candidate,
            ]),
          ).values(),
        ]
      : varied;
  return [...pool].sort(compareCandidates);
};
