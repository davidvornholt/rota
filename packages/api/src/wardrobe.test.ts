import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { DaySchema, OutfitEntriesSchema } from './wardrobe.ts';

const isDay = Schema.is(DaySchema);
const isEntries = Schema.is(OutfitEntriesSchema);
const garmentId = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('the wire contract', () => {
  it('accepts a calendar day', () => {
    expect(isDay('2026-10-31')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
  });

  it('rejects a day the calendar does not have', () => {
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('31.10.2026')).toBe(false);
  });

  it('takes at most one entry per slot', () => {
    expect(isEntries([{ slot: 'top', garmentId }])).toBe(true);
    expect(isEntries([{ slot: 'cape', garmentId }])).toBe(false);
    expect(
      isEntries(Array.from({ length: 10 }, () => ({ slot: 'top', garmentId }))),
    ).toBe(false);
  });
});
