import { describe, expect, it } from 'bun:test';

import { localDate } from '#/shared/time/local-date.ts';
import { lastLoggedDayBefore, unloggedDaysBefore } from './wear-log-gap.ts';
import type { WearEntry } from './wear-log-repository.ts';

const today = localDate('2026-09-15');
const sixtyDaysOfSilence = 60;

const worn = (date: string): WearEntry => ({
  wornOn: localDate(date),
  garmentId: 'chinos',
  slot: 'bottom',
  source: 'proposed',
});

describe('the gap before today', () => {
  it('is nothing when the log is empty: a wardrobe never used has no gap', () => {
    expect(lastLoggedDayBefore([], today)).toBeUndefined();
    expect(unloggedDaysBefore([], today)).toEqual([]);
  });

  it('is nothing when yesterday was logged', () => {
    expect(unloggedDaysBefore([worn('2026-09-14')], today)).toEqual([]);
  });

  it('lists every blank day after the last logged one, oldest first', () => {
    const log = [worn('2026-09-01'), worn('2026-09-11'), worn('2026-09-10')];
    expect(lastLoggedDayBefore(log, today)).toBe(localDate('2026-09-11'));
    expect(unloggedDaysBefore(log, today)).toEqual(
      ['2026-09-12', '2026-09-13', '2026-09-14'].map(localDate),
    );
  });

  it('ignores what is logged for today itself', () => {
    const log = [worn('2026-09-12'), worn('2026-09-15')];
    expect(unloggedDaysBefore(log, today)).toEqual(
      ['2026-09-13', '2026-09-14'].map(localDate),
    );
  });

  it('has no horizon: a long silence is still a gap', () => {
    expect(unloggedDaysBefore([worn('2026-07-16')], today)).toHaveLength(
      sixtyDaysOfSilence,
    );
  });
});
