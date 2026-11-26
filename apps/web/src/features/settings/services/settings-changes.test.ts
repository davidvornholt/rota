import { describe, expect, it } from 'bun:test';
import { Effect, Result } from 'effect';
import { defaultSettings, type Settings } from '#/shared/data/settings.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { apiSettings, changedRotation } from './settings-changes.ts';

const stored: Settings = {
  ...defaultSettings,
  cleanTopAnchor: localDate('2026-11-02'),
  categoryBudgets: { jumper: 2, shirt: 3 },
  revision: 5,
};

const changed = (changes: Parameters<typeof changedRotation>[1]) =>
  Effect.runSync(Effect.result(changedRotation(stored, changes)));

const failure = (changes: Parameters<typeof changedRotation>[1]) =>
  Result.match(changed(changes), {
    onSuccess: () => '',
    onFailure: (error) => error.message,
  });

describe('changedRotation', () => {
  it('changes the named settings and categories and keeps the rest', () => {
    const rotation = Result.getOrThrow(
      changed({ laundryDays: 3, wearBudgets: { jumper: 6, shirt: null } }),
    );
    expect(rotation).toMatchObject({
      laundryDays: 3,
      cooldownDays: defaultSettings.cooldownDays,
      cleanTopAnchor: '2026-11-02',
    });
    expect(rotation.categoryBudgets).toMatchObject({
      jumper: 6,
      shirt: 2,
      trousers: 4,
    });
  });

  it('clears the clean top day only when asked', () => {
    expect(
      Result.getOrThrow(changed({ cleanTopFrom: null })).cleanTopAnchor,
    ).toBeNull();
  });

  it("rejects what the settings form wouldn't save, with the reason", () => {
    expect(failure({ wearBudgets: { shoes: 3 } })).toContain(
      'shoes is not a category that goes to the wash',
    );
    expect(failure({ wearBudgets: { cape: 3 } })).toContain('cape');
    expect(failure({ wearBudgets: { jumper: 31 } })).toContain(
      'Invalid settings',
    );
    expect(failure({ proposalHour: 24 })).toContain('Invalid settings');
    expect(failure({ laundryDays: 1.5 })).toContain('Invalid settings');
  });
});

describe('apiSettings', () => {
  it('shows every washed category with the budget in force', () => {
    const shown = apiSettings(stored);
    expect(shown.wearBudgets).toMatchObject({
      jumper: 2,
      shirt: 3,
      trousers: 4,
    });
    expect(Object.keys(shown.wearBudgets)).not.toContain('shoes');
    expect(shown.cleanTopFrom).toBe('2026-11-02');
    expect(shown.location).toBeNull();
  });
});
