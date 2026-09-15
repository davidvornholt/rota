import { describe, expect, it } from 'bun:test';

import { localDate } from '#/shared/time/local-date.ts';
import {
  blankChoices,
  dayBefore,
  daysToSave,
  replaceAt,
} from './catch-up-choices.ts';

const dates = ['2026-09-12', '2026-09-13', '2026-09-14'].map(localDate);
const lastLogged = { bottom: 'chinos', top: 'shirt' };

describe('catching up on blank days', () => {
  it('copies the last logged outfit onto the first day and the previous day onto the rest', () => {
    const choices = replaceAt(blankChoices(dates.length), 0, {
      bottom: 'jeans',
    });
    expect(dayBefore(choices, 0, lastLogged)).toEqual(lastLogged);
    expect(dayBefore(choices, 1, lastLogged)).toEqual({ bottom: 'jeans' });
    expect(dayBefore(choices, 2, lastLogged)).toEqual({});
  });

  it('has nothing to copy for the first day when nothing was ever logged', () => {
    expect(dayBefore(blankChoices(dates.length), 0, undefined)).toBeUndefined();
  });

  it('writes only the days with a garment picked, in slot order, and skips cleared slots', () => {
    const choices = replaceAt(
      replaceAt(blankChoices(dates.length), 2, { top: 'tee', bottom: 'jeans' }),
      0,
      { bottom: '', over: 'coat' },
    );
    expect(daysToSave(dates, choices)).toEqual([
      { date: dates[0], entries: [{ garmentId: 'coat', slot: 'over' }] },
      {
        date: dates[2],
        entries: [
          { garmentId: 'jeans', slot: 'bottom' },
          { garmentId: 'tee', slot: 'top' },
        ],
      },
    ]);
    expect(daysToSave(dates, blankChoices(dates.length))).toEqual([]);
  });
});
