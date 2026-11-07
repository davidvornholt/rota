import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { logOutfit, type SettlementDeps } from './proposal-settlement.ts';

const yesterday = localDate('2026-09-06');
const teeId = '3b97f500-0000-4000-8000-000000000002';
const jumperId = 'd9c7b500-0000-4000-8000-000000000003';
const entries = [{ garmentId: jumperId, slot: 'top' as const }];

const depsWith = (logged: ReadonlyArray<WearEntry>) => {
  const written: Array<string> = [];
  const deps = {
    proposals: {
      latestForDate: () => Effect.succeed(undefined),
      setStatus: () => Effect.void,
    },
    wearLog: {
      readDay: () => Effect.succeed(logged),
      replaceDay: (_date: unknown, _entries: unknown, source: string) =>
        Effect.sync(() => {
          written.push(source);
        }),
    },
  } as unknown as SettlementDeps;
  return { deps, written };
};

describe('catching up on a past day', () => {
  it('fills a blank day', async () => {
    const { deps, written } = depsWith([]);
    await Effect.runPromise(logOutfit(deps, yesterday, entries, 'backfill'));
    expect(written).toEqual(['backfill']);
  });

  it('keeps a day that was logged on another device meanwhile', async () => {
    const { deps, written } = depsWith([
      { garmentId: teeId, slot: 'top', wornOn: yesterday, source: 'proposed' },
    ]);
    const result = await Effect.runPromise(
      Effect.result(logOutfit(deps, yesterday, entries, 'backfill')),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ProposalStateError' },
    });
    expect(written).toEqual([]);
    // A correction from the history editor still replaces a logged day.
    await Effect.runPromise(logOutfit(deps, yesterday, entries, 'edited'));
    expect(written).toEqual(['edited']);
  });
});
