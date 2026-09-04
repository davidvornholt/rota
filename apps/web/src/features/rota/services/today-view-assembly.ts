/**
 * The pure half of the Today page: given what the repositories hold, the
 * pieces the page shows. Nothing here touches a service; the Today service
 * fetches, then hands everything to these.
 */

import type { Garment } from '#/shared/data/garment.ts';
import { effectiveWearBudget, slotOrder } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { Proposal } from '#/shared/data/proposal-repository.ts';
import type { Settings } from '#/shared/data/settings-repository.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import {
  addDays,
  daysBetween,
  daysInRange,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import { consecutiveWears, outfitOn } from '../rotation.ts';
import type {
  ProposalView,
  TodayProblem,
  UnloggedDay,
  WornItemView,
} from '../schemas/today-view.ts';

/** Gaps older than this are history, not this morning's business. */
const backfillHorizonDays = 7;

export const wardrobeEmptyProblem: TodayProblem = {
  kind: 'wardrobe-empty',
  message:
    'The wardrobe is empty. Photograph your clothes to give Rota something to work with.',
};

type TaggedFailure = { readonly _tag: string; readonly message: string };

const problemKinds: ReadonlyMap<string, TodayProblem['kind']> = new Map([
  ['LocationMissingError', 'location-missing'],
  ['ForecastUnavailableError', 'forecast-unavailable'],
  ['SlotEmptyError', 'slot-empty'],
  ['ProposalAnswerError', 'answer-unusable'],
]);

/** The failures the page can explain to the wearer; anything else stays a failure. */
export const problemOf = (error: unknown): TodayProblem | undefined => {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('_tag' in error) ||
    !('message' in error)
  ) {
    return undefined;
  }
  const failure = error as TaggedFailure;
  const kind = problemKinds.get(failure._tag);
  return kind === undefined ? undefined : { kind, message: failure.message };
};

export const proposalView = (
  proposal: Proposal | undefined,
  views: ReadonlyMap<string, GarmentView>,
): ProposalView | null => {
  if (proposal === undefined || proposal.status !== 'pending') {
    return null;
  }
  return {
    id: proposal.id,
    status: proposal.status,
    headline: proposal.payload.headline,
    forecastStale: proposal.payload.forecastStale,
    occasion: proposal.payload.occasion,
    items: proposal.payload.items.flatMap((item) => {
      const garment = views.get(item.garmentId);
      return garment === undefined ? [] : [{ ...item, garment }];
    }),
  };
};

export type DayRecords = {
  readonly settings: Settings;
  readonly log: ReadonlyArray<WearEntry>;
  readonly all: ReadonlyArray<Garment>;
  readonly views: ReadonlyMap<string, GarmentView>;
};

export const wornOn = (
  date: LocalDate,
  { settings, log, all, views }: DayRecords,
): ReadonlyArray<WornItemView> | null => {
  const outfit = outfitOn(log, date);
  const items = slotOrder.flatMap((slot): ReadonlyArray<WornItemView> => {
    const id = outfit[slot];
    const view = id === undefined ? undefined : views.get(id);
    const garment = all.find((candidate) => candidate.id === id);
    if (view === undefined || garment === undefined) {
      return [];
    }
    return [
      {
        slot,
        garment: view,
        dayOfBudget: consecutiveWears(log, garment.id, date) + 1,
        budget: effectiveWearBudget(garment, settings.categoryBudgets),
      },
    ];
  });
  return items.length === 0 ? null : items;
};

/** The days between the last logged one and today that have no log, with the outfit before them. */
export const unloggedDaysBefore = (
  today: LocalDate,
  log: ReadonlyArray<WearEntry>,
  names: ReadonlyMap<string, string>,
): ReadonlyArray<UnloggedDay> => {
  const past = log
    .map((entry) => entry.wornOn)
    .filter((date) => date < today)
    .sort();
  const last = past.at(-1);
  if (last === undefined || daysBetween(last, today) > backfillHorizonDays) {
    return [];
  }
  const previousNames = Object.values(outfitOn(log, last)).map(
    (id) => names.get(id) ?? 'unknown garment',
  );
  return daysInRange(addDays(last, 1), addDays(today, -1)).map((date) => ({
    date,
    previousDate: last,
    previousNames,
  }));
};

const listNames = (items: ReadonlyArray<WornItemView>) =>
  items.map((item) => item.garment.name.toLowerCase()).join(' and ');

/** What tomorrow already knows once today is logged: which rotations end. */
export const tomorrowHint = (
  worn: ReadonlyArray<WornItemView> | null,
): string | null => {
  if (worn === null) {
    return null;
  }
  const spent = worn.filter((item) => item.dayOfBudget >= item.budget);
  if (spent.length > 0) {
    return `Today was the last day for the ${listNames(spent)}; tomorrow starts fresh there.`;
  }
  const ending = worn.filter((item) => item.dayOfBudget + 1 === item.budget);
  if (ending.length > 0) {
    return `Tomorrow is the last day for the ${listNames(ending)}.`;
  }
  return null;
};
