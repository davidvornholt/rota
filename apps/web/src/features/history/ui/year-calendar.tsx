import { Link } from '@tanstack/react-router';

import {
  addDays,
  daysInRange,
  firstOfMonth,
  formatLongDate,
  formatMonthYear,
  type LocalDate,
  localDate,
  weekdayIndex,
} from '#/shared/time/local-date.ts';
import type { CalendarDay } from '../services/history-fns.ts';

type YearCalendarProps = {
  readonly year: number;
  readonly today: LocalDate;
  readonly days: ReadonlyArray<CalendarDay>;
};

const monthsPerYear = 12;
const monthNumberWidth = 2;

const monthStarts = (year: number): ReadonlyArray<LocalDate> =>
  Array.from({ length: monthsPerYear }, (_, index) =>
    localDate(
      `${year}-${String(index + 1).padStart(monthNumberWidth, '0')}-01`,
    ),
  );

/** More than any month has, so the jump always lands in the next one. */
const pastMonthEnd = 32;

const lastOfMonth = (first: LocalDate): LocalDate =>
  addDays(firstOfMonth(addDays(first, pastMonthEnd)), -1);

const weekdayLetters = [
  { key: 'mon', letter: 'M' },
  { key: 'tue', letter: 'T' },
  { key: 'wed', letter: 'W' },
  { key: 'thu', letter: 'T' },
  { key: 'fri', letter: 'F' },
  { key: 'sat', letter: 'S' },
  { key: 'sun', letter: 'S' },
] as const;

/** The stacked colours of one logged day, trousers at the bottom. */
const DaySwatch = ({ day }: { readonly day: CalendarDay }) => {
  const count = day.items.length;
  return (
    <svg
      aria-hidden="true"
      className="size-full"
      preserveAspectRatio="none"
      viewBox={`0 0 1 ${count}`}
    >
      {day.items.map((item, position) => (
        <rect
          fill={item.hex ?? 'var(--color-ink-faint)'}
          height={1}
          key={item.slot}
          width={1}
          x={0}
          y={count - 1 - position}
        />
      ))}
    </svg>
  );
};

const DayCell = ({
  date,
  today,
  logged,
}: {
  readonly date: LocalDate;
  readonly today: LocalDate;
  readonly logged: CalendarDay | undefined;
}) => {
  if (date > today) {
    return <span aria-hidden="true" className="block aspect-square" />;
  }
  const label =
    logged === undefined
      ? `${formatLongDate(date)}: nothing logged`
      : `${formatLongDate(date)}: ${logged.items.map((item) => item.name).join(', ')}`;
  return (
    <Link
      aria-label={label}
      className={[
        'block aspect-square border hover:outline hover:outline-1 hover:outline-ink',
        date === today ? 'border-ink' : 'border-transparent',
        logged === undefined ? 'bg-paper-deep' : '',
      ].join(' ')}
      params={{ date }}
      to="/history/$date"
    >
      {logged === undefined ? null : <DaySwatch day={logged} />}
    </Link>
  );
};

const Month = ({
  first,
  today,
  byDate,
}: {
  readonly first: LocalDate;
  readonly today: LocalDate;
  readonly byDate: ReadonlyMap<LocalDate, CalendarDay>;
}) => {
  const leading = weekdayLetters.slice(0, weekdayIndex(first));
  return (
    <section aria-label={formatMonthYear(first)}>
      <h3 className="type-eyebrow">{formatMonthYear(first)}</h3>
      <ol className="mt-2 grid grid-cols-7 gap-1">
        {weekdayLetters.map((weekday) => (
          <li
            aria-hidden="true"
            className="type-data text-center text-[10px] text-ink-faint"
            key={weekday.key}
          >
            {weekday.letter}
          </li>
        ))}
        {leading.map((weekday) => (
          <li aria-hidden="true" key={`pad-${weekday.key}`} />
        ))}
        {daysInRange(first, lastOfMonth(first)).map((date) => (
          <li key={date}>
            <DayCell date={date} logged={byDate.get(date)} today={today} />
          </li>
        ))}
      </ol>
    </section>
  );
};

/**
 * The year as swatches: every logged day is a cell stacked with the colours of
 * what was worn, trousers at the bottom. A day you can still change is a link.
 */
export const YearCalendar = ({ year, today, days }: YearCalendarProps) => {
  const byDate = new Map(days.map((day) => [day.date, day] as const));
  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {monthStarts(year).map((first) => (
        <Month byDate={byDate} first={first} key={first} today={today} />
      ))}
    </div>
  );
};
