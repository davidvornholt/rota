import { describe, expect, it } from 'bun:test';

import {
  addDays,
  daysBetween,
  daysInRange,
  hourIn,
  localDate,
  todayIn,
  weekdayIndex,
} from './local-date.ts';

const daysInLeaplessYearMinusOne = 364;
const threeDaysBack = -3;
const berlinMidnight = 0;
const losAngelesMidAfternoon = 15;
const monday = 0;
const sunday = 6;

describe('local dates', () => {
  it('rejects anything that is not a calendar day', () => {
    expect(() => localDate('2026-9-4')).toThrow();
    expect(() => localDate('2026-09-04T00:00')).toThrow();
  });

  it('adds and subtracts days across month and year ends', () => {
    expect(addDays(localDate('2026-12-31'), 1)).toBe(localDate('2027-01-01'));
    expect(addDays(localDate('2026-03-01'), -1)).toBe(localDate('2026-02-28'));
    expect(daysBetween(localDate('2026-01-01'), localDate('2026-12-31'))).toBe(
      daysInLeaplessYearMinusOne,
    );
    expect(daysBetween(localDate('2026-09-04'), localDate('2026-09-01'))).toBe(
      threeDaysBack,
    );
  });

  it('resolves the day and hour in the configured zone, not the machine zone', () => {
    const lateEveningUtc = new Date('2026-09-04T22:30:00Z');
    expect(todayIn('Europe/Berlin', lateEveningUtc)).toBe(
      localDate('2026-09-05'),
    );
    expect(hourIn('Europe/Berlin', lateEveningUtc)).toBe(berlinMidnight);
    expect(todayIn('America/Los_Angeles', lateEveningUtc)).toBe(
      localDate('2026-09-04'),
    );
    expect(hourIn('America/Los_Angeles', lateEveningUtc)).toBe(
      losAngelesMidAfternoon,
    );
  });

  it('starts the week on Monday', () => {
    expect(weekdayIndex(localDate('2026-09-07'))).toBe(monday);
    expect(weekdayIndex(localDate('2026-09-06'))).toBe(sunday);
  });

  it('lists an inclusive range and nothing for a reversed one', () => {
    expect(
      daysInRange(localDate('2026-09-03'), localDate('2026-09-05')),
    ).toEqual(['2026-09-03', '2026-09-04', '2026-09-05'].map(localDate));
    expect(
      daysInRange(localDate('2026-09-05'), localDate('2026-09-03')),
    ).toEqual([]);
  });
});
