/**
 * What the wear log says when you look back at it. Everything here is derived
 * on request from the log, the garments, the forecasts, and the proposals;
 * nothing is stored twice.
 */

import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import {
  addDays,
  daysInRange,
  type LocalDate,
  monthOf,
} from '#/shared/time/local-date.ts';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const lastWinterMonth = 2;
const lastSpringMonth = 5;
const lastSummerMonth = 8;
const december = 12;

export const seasonOf = (date: LocalDate): Season => {
  const month = monthOf(date);
  if (month <= lastWinterMonth || month === december) {
    return 'winter';
  }
  if (month <= lastSpringMonth) {
    return 'spring';
  }
  if (month <= lastSummerMonth) {
    return 'summer';
  }
  return 'autumn';
};

const inSeason = (garment: GarmentView, season: Season): boolean =>
  garment.seasons.length === 0 || garment.seasons.includes(season);

/** Active garments in season that have gone unworn for a long while, longest first. */
export const neglectedDays = 90;

export const neglected = (
  garments: ReadonlyArray<GarmentView>,
  today: LocalDate,
): ReadonlyArray<GarmentView> =>
  garments
    .filter(
      (garment) =>
        garment.status === 'active' &&
        inSeason(garment, seasonOf(today)) &&
        (garment.daysSinceWorn === null ||
          garment.daysSinceWorn >= neglectedDays),
    )
    .sort(
      (left, right) =>
        (right.daysSinceWorn ?? Number.POSITIVE_INFINITY) -
        (left.daysSinceWorn ?? Number.POSITIVE_INFINITY),
    );

export const mostWorn = (
  garments: ReadonlyArray<GarmentView>,
  limit: number,
): ReadonlyArray<GarmentView> =>
  garments
    .filter((garment) => garment.wears > 0)
    .sort((left, right) => right.wears - left.wears)
    .slice(0, limit);

export type BoardRow = {
  readonly garment: GarmentView;
  readonly slot: Slot;
  readonly worn: ReadonlyArray<boolean>;
};

export type Board = {
  readonly days: ReadonlyArray<LocalDate>;
  readonly rows: ReadonlyArray<BoardRow>;
};

/**
 * The rota board: recent days across, the garments worn in them down, grouped
 * by slot in worn order and, within a slot, by first appearance.
 */
export const board = (
  log: ReadonlyArray<WearEntry>,
  garments: ReadonlyMap<string, GarmentView>,
  today: LocalDate,
  dayCount: number,
): Board => {
  const days = daysInRange(addDays(today, -(dayCount - 1)), today);
  const firstSeen = new Map<string, { slot: Slot; index: number }>();
  for (const entry of log) {
    const index = days.indexOf(entry.wornOn);
    if (index !== -1 && !firstSeen.has(entry.garmentId)) {
      firstSeen.set(entry.garmentId, { slot: entry.slot, index });
    }
  }
  const rows = [...firstSeen.entries()]
    .flatMap(([garmentId, seen]) => {
      const garment = garments.get(garmentId);
      if (garment === undefined) {
        return [];
      }
      return [
        {
          garment,
          slot: seen.slot,
          index: seen.index,
          worn: days.map((day) =>
            log.some(
              (entry) => entry.wornOn === day && entry.garmentId === garmentId,
            ),
          ),
        },
      ];
    })
    .sort(
      (left, right) =>
        slotOrder.indexOf(left.slot) - slotOrder.indexOf(right.slot) ||
        left.index - right.index,
    )
    .map(({ garment, slot, worn }) => ({ garment, slot, worn }));
  return { days, rows };
};

export type TemperatureRow = {
  readonly garment: GarmentView;
  readonly highs: ReadonlyArray<number>;
  readonly lowest: number;
  readonly highest: number;
  readonly median: number;
};

const median = (values: ReadonlyArray<number>): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
};

/** Fewer wears than this and a temperature range would be noise. */
const minimumWearsForTemperature = 3;

/** The afternoon highs each garment was actually worn at; only garments worn often enough. */
export const temperatureByGarment = (
  log: ReadonlyArray<WearEntry>,
  weather: ReadonlyArray<WeatherDay>,
  garments: ReadonlyMap<string, GarmentView>,
): ReadonlyArray<TemperatureRow> => {
  const highByDay = new Map(
    weather.map((day) => [day.date, day.high] as const),
  );
  const highs = new Map<string, Array<number>>();
  for (const entry of log) {
    const high = highByDay.get(entry.wornOn);
    if (high !== undefined) {
      const list = highs.get(entry.garmentId) ?? [];
      list.push(high);
      highs.set(entry.garmentId, list);
    }
  }
  return [...highs.entries()]
    .flatMap(([garmentId, values]) => {
      const garment = garments.get(garmentId);
      if (garment === undefined || values.length < minimumWearsForTemperature) {
        return [];
      }
      return [
        {
          garment,
          highs: values,
          lowest: Math.min(...values),
          highest: Math.max(...values),
          median: median(values),
        },
      ];
    })
    .sort((left, right) => left.median - right.median);
};

export type ColorShare = {
  readonly name: string;
  readonly hex: string;
  readonly share: number;
};

const shares = (
  weighted: ReadonlyArray<{
    readonly garment: GarmentView;
    readonly weight: number;
  }>,
): ReadonlyArray<ColorShare> => {
  const totals = new Map<string, { hex: string; weight: number }>();
  let sum = 0;
  for (const { garment, weight } of weighted) {
    const [dominant] = garment.colors;
    if (dominant !== undefined && weight > 0) {
      const key = dominant.name.toLowerCase();
      const current = totals.get(key) ?? { hex: dominant.hex, weight: 0 };
      totals.set(key, { hex: current.hex, weight: current.weight + weight });
      sum += weight;
    }
  }
  return [...totals.entries()]
    .map(([name, { hex, weight }]) => ({
      name,
      hex,
      share: sum === 0 ? 0 : weight / sum,
    }))
    .sort((left, right) => right.share - left.share);
};

/** Dominant colours of what you own against what you actually wear. */
export const colorDistribution = (
  garments: ReadonlyArray<GarmentView>,
): {
  readonly owned: ReadonlyArray<ColorShare>;
  readonly worn: ReadonlyArray<ColorShare>;
} => {
  const active = garments.filter((garment) => garment.status !== 'processing');
  return {
    owned: shares(active.map((garment) => ({ garment, weight: 1 }))),
    worn: shares(active.map((garment) => ({ garment, weight: garment.wears }))),
  };
};

export type Adherence = {
  readonly decidedDays: number;
  readonly acceptedFirst: number;
  readonly acceptedAfterReroll: number;
  readonly overridden: number;
};

/** How often the morning's first proposal was the one you wore. */
export const adherence = (
  log: ReadonlyArray<WearEntry>,
  proposals: ReadonlyArray<Proposal>,
): Adherence => {
  const sourceByDay = new Map<LocalDate, WearEntry['source']>();
  for (const entry of log) {
    sourceByDay.set(entry.wornOn, entry.source);
  }
  let acceptedFirst = 0;
  let acceptedAfterReroll = 0;
  let overridden = 0;
  for (const [day, source] of sourceByDay) {
    if (source === 'override') {
      overridden += 1;
    } else if (source === 'proposed') {
      const rejectedThatDay = proposals.some(
        (proposal) =>
          proposal.forDate === day && proposal.status === 'rejected',
      );
      if (rejectedThatDay) {
        acceptedAfterReroll += 1;
      } else {
        acceptedFirst += 1;
      }
    }
  }
  return {
    decidedDays: acceptedFirst + acceptedAfterReroll + overridden,
    acceptedFirst,
    acceptedAfterReroll,
    overridden,
  };
};
