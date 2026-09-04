import { describe, expect, it } from 'bun:test';

import { isTimeZone } from './time-zone.ts';

describe('isTimeZone', () => {
  it('separates a zone the platform resolves from one it does not', () => {
    expect(isTimeZone('Europe/Berlin')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Europe/Bergstadt')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });
});
