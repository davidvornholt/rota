import { describe, expect, it } from 'bun:test';
import { openWardrobe } from './open-wardrobe.ts';

describe('openWardrobe', () => {
  it('drops both caches before the wardrobe shows', async () => {
    const calls: Array<string> = [];
    const record = (name: string) => () => {
      calls.push(name);
      return Promise.resolve();
    };
    await openWardrobe(
      {
        clearCache: () => calls.push('router cache'),
        invalidate: record('invalidate'),
        navigate: record('navigate'),
      },
      { clear: () => calls.push('query cache') },
    );
    expect(calls.indexOf('query cache')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('router cache')).toBeGreaterThanOrEqual(0);
    expect(calls.at(-1)).toBe('navigate');
  });
});
