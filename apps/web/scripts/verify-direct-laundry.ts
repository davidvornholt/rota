// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { changePlanning } from '#/features/rota/services/planning-service.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import {
  type OutfitEntry,
  WearLogRepository,
} from '#/shared/data/wear-log-repository.ts';
import { addDays } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

const unloggedDayOffset = 20;

export const verifyDirectLaundry = (
  clock: WardrobeClock,
  entries: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const outfits = yield* OutfitRepository;
    const wearLog = yield* WearLogRepository;
    const before = yield* wearLog.history();
    const futureDate = addDays(clock.actualToday, unloggedDayOffset);
    const nextClock = { ...clock, today: futureDate, actualToday: futureDate };
    const [first] = entries;
    assert(first !== undefined);
    yield* changePlanning(nextClock, {
      action: 'care',
      care: 'laundry',
      ids: [first.garmentId],
      draft: { entries, basedOn: null },
    });
    assert.deepEqual(
      (yield* outfits.plan(nextClock.today)).entries,
      entries.slice(1),
      'Dirty proposed pieces leave a persisted gap for manual replacement.',
    );
    assert.deepEqual(
      yield* wearLog.history(),
      before,
      'Sending to laundry never records or removes wears.',
    );
    const recordedPlan = yield* outfits.plan(clock.today);
    yield* changePlanning(clock, {
      action: 'care',
      care: 'laundry',
      ids: [first.garmentId],
      draft: { entries, basedOn: null },
    });
    assert.deepEqual(
      yield* outfits.plan(clock.today),
      recordedPlan,
      'A stale draft cannot replace an already logged day.',
    );
    assert.deepEqual(
      yield* wearLog.history(),
      before,
      'Sending a worn garment to laundry preserves recorded history.',
    );
  });
