/**
 * The rotation engine: everything about what to wear that does not need a
 * model. It reads the wear log (the only truth), decides which of yesterday's
 * garments may carry on, and narrows the wardrobe to the few candidates worth
 * putting in front of Gemini for each slot that is open. Total and synchronous;
 * the day, the log, and the forecast arrive as arguments.
 */

import type { Garment } from '#/shared/data/garment.ts';
import {
  effectiveWearBudget,
  type Slot,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
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

/** How much the forecast-window high counts against its low in the felt temperature. */
const highWeight = 0.6;
const lowWeight = 1 - highWeight;

/** Felt-temperature floors, warmest band first; below the last one it is cold. */
const bandFloors: ReadonlyArray<{
  readonly band: number;
  readonly felt: number;
}> = [
  { band: 1, felt: 18 },
  { band: 2, felt: 12 },
];
const coldestBand = 3;

/**
 * The day's garment warmth, 1 (light), 2 (medium), or 3 (heavy), from a felt temperature that
 * leans on the high: you dress for the afternoon you will be out in.
 */
export const warmthBand = (day: Pick<WeatherDay, 'high' | 'low'>): number => {
  const felt = day.high * highWeight + day.low * lowWeight;
  return bandFloors.find((floor) => felt >= floor.felt)?.band ?? coldestBand;
};

const rainProbabilityThreshold = 50;
const rainMillimetresThreshold = 2;

export const rainLikely = (
  day: Pick<WeatherDay, 'precipitationProbability' | 'precipitationMm'>,
): boolean =>
  day.precipitationProbability >= rainProbabilityThreshold ||
  day.precipitationMm >= rainMillimetresThreshold;

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
  readonly weatherFits: boolean;
};

export type RotationInput = {
  readonly today: LocalDate;
  readonly log: ReadonlyArray<WearEntry>;
  readonly garments: ReadonlyArray<Garment>;
  readonly settings: RotationSettings;
  readonly weather: WeatherDay;
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
  const band = warmthBand(input.weather);
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
        weatherFits:
          Math.abs(garment.warmth - band) <= 1 &&
          (garment.rainOk || !rainLikely(input.weather)),
      },
    ];
  });
};

export type Candidate = {
  readonly garment: Garment;
  readonly daysSinceWorn: number | null;
  readonly warmthDistance: number;
  /** Worn more recently than the cooldown allows; offered only when nothing else is. */
  readonly inCooldown: boolean;
};

export const candidateLimit = 8;

const compareCandidates = (left: Candidate, right: Candidate): number => {
  if (left.inCooldown !== right.inCooldown) {
    return left.inCooldown ? 1 : -1;
  }
  if (left.warmthDistance !== right.warmthDistance) {
    return left.warmthDistance - right.warmthDistance;
  }
  const leftRest = left.daysSinceWorn ?? Number.POSITIVE_INFINITY;
  const rightRest = right.daysSinceWorn ?? Number.POSITIVE_INFINITY;
  return rightRest - leftRest;
};

/** Below this many well-fitting candidates, garments one band further off are offered too. */
const comfortableChoice = 3;

/**
 * The garments worth offering for one slot, best first: right for the weather,
 * longest since worn. Garments a band too warm or too cool join only when the
 * close fits are few; garments still in cooldown are kept out unless the slot
 * would otherwise be empty, in which case they are offered and marked.
 */
export const candidatesFor = (
  input: RotationInput,
  slot: Slot,
  alreadyChosen: ReadonlySet<string>,
): ReadonlyArray<Candidate> => {
  const band = warmthBand(input.weather);
  const wet = rainLikely(input.weather);
  const all = input.garments.flatMap((garment): ReadonlyArray<Candidate> => {
    if (
      garment.status !== 'active' ||
      !garment.slots.includes(slot) ||
      input.excluded.has(garment.id) ||
      alreadyChosen.has(garment.id) ||
      (wet && !garment.rainOk)
    ) {
      return [];
    }
    const warmthDistance = Math.abs(garment.warmth - band);
    if (warmthDistance > 1) {
      return [];
    }
    const rest = daysSinceWorn(input.log, garment.id, input.today);
    return [
      {
        garment,
        daysSinceWorn: rest,
        warmthDistance,
        inCooldown: rest !== null && rest < input.settings.cooldownDays,
      },
    ];
  });
  const close = all.filter((candidate) => candidate.warmthDistance === 0);
  const byWeather = close.length >= comfortableChoice ? close : all;
  const rested = byWeather.filter((candidate) => !candidate.inCooldown);
  const pool = rested.length > 0 ? rested : byWeather;
  return [...pool].sort(compareCandidates).slice(0, candidateLimit);
};
