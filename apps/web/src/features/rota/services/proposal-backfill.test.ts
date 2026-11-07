import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Fiber } from 'effect';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { makeProposalOperations } from './proposal-operations.ts';
import {
  logDays,
  logOutfit,
  type SettlementDeps,
} from './proposal-settlement.ts';

const monday = localDate('2026-09-07');
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

describe('catching up on several days', () => {
  it('writes none of them when one was logged meanwhile', async () => {
    const { deps, written } = depsWith([]);
    deps.wearLog.readDay = (date) =>
      Effect.succeed(
        date === monday
          ? [
              {
                garmentId: teeId,
                slot: 'top',
                wornOn: date,
                source: 'proposed',
              },
            ]
          : [],
      );
    const result = await Effect.runPromise(
      Effect.result(
        logDays(deps, [
          { date: yesterday, entries },
          { date: monday, entries },
        ]),
      ),
    );
    expect(result._tag).toBe('Failure');
    expect(written).toEqual([]);
  });

  it('keeps another tab out until all of them are saved', async () => {
    const log = new Map<string, ReadonlyArray<WearEntry>>();
    const { deps } = depsWith([]);
    const run = Effect.gen(function* () {
      const reading = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      let isFirstRead = true;
      // The catch-up's first look at Monday is held until the test lets go.
      deps.wearLog.readDay = (date) =>
        Effect.gen(function* () {
          const logged = log.get(date) ?? [];
          if (date === monday && isFirstRead) {
            isFirstRead = false;
            yield* Deferred.succeed(reading, undefined);
            yield* Deferred.await(release);
          }
          return logged;
        });
      deps.wearLog.replaceDay = (date, logged, source) =>
        Effect.sync(() => {
          log.set(
            date,
            logged.map((entry) => ({ ...entry, wornOn: date, source })),
          );
        });
      const operations = yield* makeProposalOperations(deps);
      const catchUp = yield* Effect.forkChild(
        Effect.result(
          operations.logDays([
            { date: yesterday, entries },
            { date: monday, entries },
          ]),
        ),
      );
      yield* Deferred.await(reading);
      // Another tab logs Monday after the catch-up looked at it.
      const otherTab = yield* Effect.forkChild(
        operations.logOutfit(
          monday,
          [{ garmentId: teeId, slot: 'top' }],
          'edited',
        ),
      );
      yield* Effect.yieldNow;
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(otherTab);
      return yield* Fiber.join(catchUp);
    });
    const result = await Effect.runPromise(run);
    const saved = [...log.entries()].map(([date, logged]) => [
      date,
      logged.map((entry) => entry.source),
    ]);
    // The other tab waits for the catch-up, then corrects Monday.
    expect(result._tag).toBe('Success');
    expect(saved).toEqual([
      [yesterday, ['backfill']],
      [monday, ['edited']],
    ]);
  });
});
