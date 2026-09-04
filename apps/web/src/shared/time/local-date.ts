/**
 * A calendar day as `YYYY-MM-DD`, never a timestamp. The wear log, the
 * proposals, and the forecast are all keyed by the day it is where the
 * wardrobe stands, so the day is computed once against the configured zone and
 * from then on is just a string that sorts and compares correctly.
 *
 * The brand is hand-rolled rather than a Schema brand so the browser bundle can
 * carry dates without the decoding machinery; `local-date-schema.ts` is the
 * server-side schema that produces the same type.
 */
declare const localDateBrand: unique symbol;

export type LocalDate = string & { readonly [localDateBrand]: 'LocalDate' };

export const localDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

export const isLocalDate = (value: string): value is LocalDate =>
  localDatePattern.test(value);

/** Brands a string the caller already knows is a calendar day; a malformed one is a programming error. */
export const localDate = (value: string): LocalDate => {
  if (!isLocalDate(value)) {
    throw new TypeError(`Not a calendar day: ${value}`);
  }
  return value;
};

const utcDateOf = (date: LocalDate): Date => new Date(`${date}T00:00:00Z`);

const toLocalDate = (utc: Date): LocalDate =>
  localDate(utc.toISOString().slice(0, 10));

const millisecondsPerDay = 86_400_000;

export const addDays = (date: LocalDate, days: number): LocalDate =>
  toLocalDate(new Date(utcDateOf(date).getTime() + days * millisecondsPerDay));

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: LocalDate, to: LocalDate): number =>
  Math.round(
    (utcDateOf(to).getTime() - utcDateOf(from).getTime()) / millisecondsPerDay,
  );

const partsIn = (timeZone: string, now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    date: localDate(`${part('year')}-${part('month')}-${part('day')}`),
    // Some engines print midnight as "24"; the day above is already right.
    hour: Number(part('hour')) % 24,
  };
};

/** The calendar day it currently is in the given zone. */
export const todayIn = (timeZone: string, now: Date = new Date()): LocalDate =>
  partsIn(timeZone, now).date;

/** The hour of the day (0–23) it currently is in the given zone. */
export const hourIn = (timeZone: string, now: Date = new Date()): number =>
  partsIn(timeZone, now).hour;

const daysPerWeek = 7;
/** JavaScript counts Sunday as 0; a rota board starts on Monday. */
const sundayToMondayShift = 6;

/** 0 = Monday … 6 = Sunday, the way a rota board is drawn. */
export const weekdayIndex = (date: LocalDate): number =>
  (utcDateOf(date).getUTCDay() + sundayToMondayShift) % daysPerWeek;

export const formatWeekday = (
  date: LocalDate,
  style: 'long' | 'short' = 'long',
): string =>
  new Intl.DateTimeFormat('en-GB', { weekday: style, timeZone: 'UTC' }).format(
    utcDateOf(date),
  );

export const formatDayMonth = (date: LocalDate): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utcDateOf(date));

export const formatLongDate = (date: LocalDate): string =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDateOf(date));

export const formatMonthYear = (date: LocalDate): string =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDateOf(date));

const yearEnd = 4;
const monthStart = 5;
const monthEnd = 7;
const dayStart = 8;

export const yearOf = (date: LocalDate): number =>
  Number(date.slice(0, yearEnd));

export const monthOf = (date: LocalDate): number =>
  Number(date.slice(monthStart, monthEnd));

export const firstOfMonth = (date: LocalDate): LocalDate =>
  localDate(`${date.slice(0, dayStart)}01`);

/** Every day from `from` through `to`, inclusive, in order. */
export const daysInRange = (
  from: LocalDate,
  to: LocalDate,
): ReadonlyArray<LocalDate> => {
  const count = daysBetween(from, to);
  if (count < 0) {
    return [];
  }
  return Array.from({ length: count + 1 }, (_, index) => addDays(from, index));
};
