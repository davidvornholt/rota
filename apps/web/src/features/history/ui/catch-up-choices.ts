/** The catch-up page's state: one choice per blank day, oldest first, and what to write from it. */

import type { LocalDate } from '#/shared/time/local-date.ts';
import { type Choice, type DayEntries, entriesOf } from './day-choice.ts';

export type Choices = ReadonlyArray<Choice>;

export const blankChoices = (count: number): Choices =>
  Array.from({ length: count }, () => ({}));

/** What the day at `index` copies with "same as the day before": the previous day's picks, or the last logged outfit for the first day. */
export const dayBefore = (
  choices: Choices,
  index: number,
  lastLogged: Choice | undefined,
): Choice | undefined => (index === 0 ? lastLogged : choices[index - 1]);

export const replaceAt = (
  choices: Choices,
  index: number,
  choice: Choice,
): Choices =>
  choices.map((current, position) => (position === index ? choice : current));

export type DayToSave = {
  readonly date: LocalDate;
  readonly entries: DayEntries;
};

/** The days worth writing: those with at least one garment picked. A blank day stays blank. */
export const daysToSave = (
  dates: ReadonlyArray<LocalDate>,
  choices: Choices,
): ReadonlyArray<DayToSave> =>
  dates.flatMap((date, index) => {
    const entries = entriesOf(choices[index] ?? {});
    return entries.length === 0 ? [] : [{ date, entries }];
  });
