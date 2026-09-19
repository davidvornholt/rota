import { describe, expect, it } from 'bun:test';
import { localDate } from '#/shared/time/local-date.ts';
import { careFromDates } from './garment-care.ts';

const piece: Parameters<typeof careFromDates>[0] = {
  id: 'shirt',
  category: 'shirt',
  wearBudget: 2,
  washedOn: null,
  washedAfterWear: false,
  laundryStartedOn: null,
  laundryReadyOn: null,
};
const settings = { categoryBudgets: {}, laundryDays: 4 };
const care = (
  dates: ReadonlyArray<string>,
  date: string,
  overrides: Partial<typeof piece> = {},
) =>
  careFromDates(
    { ...piece, ...overrides },
    dates.map(localDate),
    localDate(date),
    settings,
  );

describe('automatic laundry', () => {
  it('starts after the final wear and returns on the configured date without a write', () => {
    const worn = ['2026-09-01', '2026-09-03'];
    expect(care(worn, '2026-09-03')).toEqual({
      wearsSinceWash: 2,
      inLaundry: true,
      readyOn: localDate('2026-09-07'),
      assumedCleanOn: null,
    });
    expect(care(worn, '2026-09-06').inLaundry).toBeTrue();
    expect(care(worn, '2026-09-07')).toEqual({
      wearsSinceWash: 0,
      inLaundry: false,
      readyOn: null,
      assumedCleanOn: localDate('2026-09-07'),
    });
  });
  it('keeps partly worn pieces available across long gaps', () => {
    expect(care(['2026-09-01'], '2026-10-01').wearsSinceWash).toBe(1);
    expect(care(['2026-09-01'], '2026-10-01').assumedCleanOn).toBeNull();
  });
  it('replays multiple cycles and counts a wear on the return date', () => {
    const worn = ['2026-09-01', '2026-09-03', '2026-09-07', '2026-09-09'];
    expect(care(worn, '2026-09-07').wearsSinceWash).toBe(1);
    expect(care(worn, '2026-09-10').readyOn).toBe(localDate('2026-09-13'));
    expect(care(worn, '2026-09-13').wearsSinceWash).toBe(0);
  });
  it('recomputes the cycle after a history correction and ignores duplicate slots', () => {
    expect(
      care(['2026-09-01', '2026-09-01'], '2026-09-04').inLaundry,
    ).toBeFalse();
    expect(
      care(['2026-09-01', '2026-09-02'], '2026-09-05').inLaundry,
    ).toBeTrue();
    expect(care(['2026-09-01'], '2026-09-05').inLaundry).toBeFalse();
  });
  it('honours early basket trips and delayed returns', () => {
    const early = {
      laundryStartedOn: localDate('2026-09-02'),
      laundryReadyOn: localDate('2026-09-06'),
    };
    expect(care(['2026-09-01'], '2026-09-05', early).inLaundry).toBeTrue();
    expect(care(['2026-09-01'], '2026-09-06', early).wearsSinceWash).toBe(0);
    const delayed = {
      laundryStartedOn: localDate('2026-09-07'),
      laundryReadyOn: localDate('2026-09-08'),
    };
    expect(
      care(['2026-09-01', '2026-09-03'], '2026-09-07', delayed).inLaundry,
    ).toBeTrue();
    expect(
      care(['2026-09-01', '2026-09-03'], '2026-09-08', delayed).inLaundry,
    ).toBeFalse();
  });
  it('preserves washing before versus after a logged wear on the same day', () => {
    const washedOn = localDate('2026-09-03');
    expect(
      care(['2026-09-01', '2026-09-03'], '2026-09-03', { washedOn })
        .wearsSinceWash,
    ).toBe(1);
    expect(
      care(['2026-09-01', '2026-09-03'], '2026-09-03', {
        washedOn,
        washedAfterWear: true,
      }).wearsSinceWash,
    ).toBe(0);
  });
  it('sends an overshirt to laundry after two wears by default', () => {
    const overshirt = { category: 'overshirt', wearBudget: null };
    expect(care(['2026-09-01'], '2026-09-01', overshirt).inLaundry).toBeFalse();
    expect(
      care(['2026-09-01', '2026-09-02'], '2026-09-02', overshirt).inLaundry,
    ).toBeTrue();
  });
  it('allows accessories to repeat freely', () => {
    for (const category of ['shoes', 'handbag']) {
      expect(
        care(['2026-09-01', '2026-09-02', '2026-09-03'], '2026-09-04', {
          category,
          wearBudget: 1,
        }).inLaundry,
      ).toBeFalse();
    }
  });
});
