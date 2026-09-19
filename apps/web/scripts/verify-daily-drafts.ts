// biome-ignore-all lint/suspicious/noMisplacedAssertion: These helpers belong to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import {
  changePlanning,
  planningView,
} from '#/features/rota/services/planning-service.ts';
import { ProposalService } from '#/features/rota/services/proposal-service.ts';
import {
  type OutfitEntry,
  WearLogRepository,
} from '#/shared/data/wear-log-repository.ts';
import { addDays } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

export const verifyDailyDrafts = (
  clock: WardrobeClock,
  entries: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const proposals = yield* ProposalService;
    const wearLog = yield* WearLogRepository;
    const nextClock = { ...clock, today: addDays(clock.today, 1) };
    for (const draft of [entries.slice(0, 1), []]) {
      yield* changePlanning(nextClock, {
        action: 'plan',
        entries: draft,
        basedOn: null,
      });
      yield* proposals.ensure(nextClock);
      assert.deepEqual(
        (yield* planningView(nextClock)).plan.entries,
        draft,
        'Partial and empty drafts survive reload and the morning scheduler.',
      );
      assert.equal((yield* wearLog.readDay(nextClock.today)).length, 0);
      const rolledOver = { ...nextClock, actualToday: nextClock.today };
      yield* proposals.ensure(rolledOver);
      assert.deepEqual(
        (yield* planningView(rolledOver)).plan.entries,
        draft,
        'Tomorrow’s dated draft becomes today’s plan without recording wear.',
      );
      assert.equal(
        (yield* Effect.either(
          changePlanning(rolledOver, {
            action: 'wear',
            entries: draft,
            basedOn: null,
          }),
        ))._tag,
        'Left',
        'An incomplete draft cannot be recorded as worn.',
      );
    }
    for (const invalid of [
      [...entries, entries[0]],
      [{ garmentId: entries[0]?.garmentId ?? '', slot: 'shoes' as const }],
      [
        {
          garmentId: '99999999-9999-4999-8999-999999999999',
          slot: 'top' as const,
        },
      ],
    ]) {
      assert.equal(
        (yield* Effect.either(
          changePlanning(nextClock, {
            action: 'plan',
            entries: invalid,
            basedOn: null,
          }),
        ))._tag,
        'Left',
        'Drafts still validate ownership, uniqueness and slots.',
      );
    }
  });

export const verifyCare = (
  clock: WardrobeClock,
  entries: ReadonlyArray<OutfitEntry>,
  otherTopId: string,
) =>
  Effect.gen(function* () {
    const nextClock = { ...clock, today: addDays(clock.today, 1) };
    const topId = entries[0]?.garmentId;
    assert(topId !== undefined);
    const swapped = [
      { garmentId: otherTopId, slot: 'top' as const },
      entries[1],
    ];
    yield* changePlanning(clock, {
      action: 'care',
      draft: null,
      care: 'washed',
      ids: [topId],
    });
    yield* changePlanning(clock, { action: 'wear', entries, basedOn: null });
    assert.equal(
      (yield* Effect.either(
        changePlanning(clock, {
          action: 'plan',
          entries: [],
          basedOn: null,
        }),
      ))._tag,
      'Left',
      'A stale autosave cannot replace a worn day.',
    );
    assert.equal(
      (yield* planningView(nextClock)).wardrobe.find(
        (garment) => garment.id === topId,
      )?.wearsSinceWash,
      1,
      'A wear after washing that morning counts.',
    );
    yield* changePlanning(clock, {
      action: 'care',
      draft: null,
      care: 'washed',
      ids: [topId],
    });
    assert.equal(
      (yield* planningView(nextClock)).wardrobe.find(
        (garment) => garment.id === topId,
      )?.wearsSinceWash,
      0,
      'Washing after wearing resets that wear.',
    );
    yield* changePlanning(clock, {
      action: 'care',
      draft: null,
      care: 'laundry',
      ids: [otherTopId],
    });
    assert.equal(
      (yield* Effect.either(
        changePlanning(nextClock, {
          action: 'plan',
          entries: swapped,
          basedOn: null,
        }),
      ))._tag,
      'Right',
      'Unavailable pieces may remain in a draft.',
    );
    assert.equal(
      (yield* Effect.either(
        changePlanning(
          { ...nextClock, actualToday: nextClock.today },
          { action: 'wear', entries: swapped, basedOn: null },
        ),
      ))._tag,
      'Left',
      'Wearing still rejects pieces in laundry.',
    );
  });
