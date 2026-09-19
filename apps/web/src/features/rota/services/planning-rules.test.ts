import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { cleanTopOn } from '#/shared/data/garment-care.ts';
import { emptyPlan } from '#/shared/data/outfit-repository.ts';
import { defaultSettings } from '#/shared/data/settings-repository.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  dateClock,
  forecastChanged,
  projectedLog,
  validateEntries,
} from './planning-rules.ts';

const today = localDate('2026-09-19');
const tomorrow = localDate('2026-09-20');
const clock = {
  today,
  actualToday: today,
  hour: 8,
  timeZone: 'Europe/Berlin',
  settings: defaultSettings,
};
const entries = [{ garmentId: 'blue', slot: 'top' as const }];
it('restricts planning to the wardrobe’s today and tomorrow', async () => {
  expect((await Effect.runPromise(dateClock(clock, tomorrow))).today).toBe(
    tomorrow,
  );
  for (const date of ['2026-09-18', '2026-09-21']) {
    expect(
      Effect.runSync(Effect.either(dateClock(clock, localDate(date))))._tag,
    ).toBe('Left');
  }
});
it('projects a saved plan only when actual wear is not known', () => {
  const plan = { ...emptyPlan, entries };
  const projected = projectedLog([], plan, { ...clock, today: tomorrow });
  expect(projected).toEqual([
    { ...entries[0], wornOn: today, source: 'override' },
  ]);
  const actual: ReadonlyArray<WearEntry> = [
    { garmentId: 'white', slot: 'top', wornOn: today, source: 'edited' },
  ];
  expect(projectedLog(actual, plan, { ...clock, today: tomorrow })).toBe(
    actual,
  );
  expect(projectedLog([], plan, clock)).toEqual([]);
});
it('applies alternate-day clean tops across month boundaries with per-day overrides', () => {
  const anchor = localDate('2026-09-30');
  expect(cleanTopOn(localDate('2026-09-28'), anchor, null)).toBeFalse();
  expect(cleanTopOn(localDate('2026-10-02'), anchor, null)).toBeTrue();
  expect(cleanTopOn(localDate('2026-10-01'), anchor, null)).toBeFalse();
  expect(cleanTopOn(localDate('2026-10-02'), anchor, false)).toBeFalse();
  expect(cleanTopOn(today, null, true)).toBeTrue();
});
it('rejects incomplete outfits, repeated pieces and invalid slots before persistence', () => {
  for (const invalid of [[], entries, [...entries, ...entries]]) {
    expect(
      Effect.runSync(Effect.either(validateEntries(invalid, [], true)))._tag,
    ).toBe('Left');
  }
});
it('warns on meaningful weather changes without replacing a plan', () => {
  const before = { high: 20, low: 12, precipitationProbability: 10 };
  expect(forecastChanged(before, { ...before, high: 21 })).toBeFalse();
  expect(forecastChanged(before, { ...before, high: 26 })).toBeTrue();
  expect(
    forecastChanged(before, { ...before, precipitationProbability: 80 }),
  ).toBeTrue();
  expect(forecastChanged(null, before)).toBeFalse();
});
