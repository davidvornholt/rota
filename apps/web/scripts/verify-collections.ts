// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Deferred, Effect, Fiber, Schedule } from 'effect';
import { SqlClient } from 'effect/sql';
import { changePlanning } from '#/features/rota/services/planning-service.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

const weekendId = '55555555-5555-4555-8555-555555555555';
const looseId = '77777777-7777-4777-8777-777777777777';
const lockWaiters = 2;
const lockPolls = 250;

/**
 * Two tabs change the same outfit's collections at once. Another connection
 * holds the outfit's row until both requests wait on a lock, so neither can
 * finish before the other has started.
 */
const verifyOverlappingChanges = (clock: WardrobeClock, id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const outfits = yield* OutfitRepository;
    const locked = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const holder = yield* Effect.forkChild(
      sql.withTransaction(
        sql`select id from saved_outfit where id = ${id} for update`.pipe(
          Effect.andThen(Deferred.succeed(locked, undefined)),
          Effect.andThen(Deferred.await(release)),
        ),
      ),
    );
    yield* Deferred.await(locked);
    const changes = yield* Effect.forkChild(
      Effect.all(
        [
          changePlanning(clock, {
            action: 'rename-collection',
            from: 'Work',
            to: 'Office',
          }),
          changePlanning(clock, {
            action: 'delete-collection',
            name: 'Summer',
          }),
        ],
        { concurrency: 'unbounded', discard: true },
      ),
    );
    const waiting = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
    `.pipe(
      Effect.map(([row]) => row?.count ?? 0),
      Effect.repeat({
        schedule: Schedule.spaced('20 millis'),
        until: (count) => count >= lockWaiters,
        times: lockPolls,
      }),
    );
    assert(
      waiting >= lockWaiters,
      `Timed out after ${lockPolls} polls: ${waiting} of ${lockWaiters} collection changes waited on a lock.`,
    );
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(holder);
    yield* Fiber.join(changes);
    assert.deepEqual(
      (yield* outfits.list()).find((item) => item.id === id)?.collections,
      ['Office'],
      'Overlapping collection changes both apply.',
    );
    yield* outfits.setCollections(id, ['Summer', 'Work']);
  });

/** Starts from the only saved outfit, "Blue and navy", in Summer and Work. */
export const verifyCollections = (
  clock: WardrobeClock,
  entries: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const outfits = yield* OutfitRepository;
    const collectionsByName = Effect.map(outfits.list(), (list) =>
      Object.fromEntries(list.map((item) => [item.name, item.collections])),
    );
    assert.deepEqual(yield* collectionsByName, {
      'Blue and navy': ['Summer', 'Work'],
    });
    const [saved] = yield* outfits.list();
    assert(saved);
    yield* verifyOverlappingChanges(clock, saved.id);
    assert.deepEqual(yield* collectionsByName, {
      'Blue and navy': ['Summer', 'Work'],
    });
    yield* changePlanning(clock, {
      action: 'save-outfit',
      id: weekendId,
      name: 'Weekend wear',
      entries,
      collections: ['summer', 'Weekend'],
    });
    assert.deepEqual(
      (yield* outfits.list()).map((item) => item.name),
      ['Weekend wear', 'Blue and navy'],
    );
    assert.deepEqual(yield* collectionsByName, {
      'Weekend wear': ['Summer', 'Weekend'],
      'Blue and navy': ['Summer', 'Work'],
    });
    yield* changePlanning(clock, {
      action: 'rename-collection',
      from: 'Weekend',
      to: ' work ',
    });
    assert.deepEqual(yield* collectionsByName, {
      'Weekend wear': ['Summer', 'Work'],
      'Blue and navy': ['Summer', 'Work'],
    });
    yield* changePlanning(clock, {
      action: 'delete-collection',
      name: 'Summer',
    });
    assert.deepEqual(
      (yield* outfits.list()).map((item) => item.name),
      ['Weekend wear', 'Blue and navy'],
      'Regrouping keeps the outfits in their order.',
    );
    assert.deepEqual(yield* collectionsByName, {
      'Weekend wear': ['Work'],
      'Blue and navy': ['Work'],
    });
    const blank = yield* Effect.result(
      changePlanning(clock, {
        action: 'rename-collection',
        from: 'Work',
        to: '  ',
      }),
    );
    assert.equal(blank._tag, 'Failure');
    yield* changePlanning(clock, {
      action: 'save-outfit',
      id: weekendId,
      name: 'Weekend wear',
      entries,
      collections: ['Trip'],
    });
    yield* changePlanning(clock, { action: 'delete-collection', name: 'Trip' });
    yield* changePlanning(clock, {
      action: 'save-outfit',
      id: looseId,
      name: 'Loose outfit',
      entries,
      collections: [],
    });
    assert.deepEqual(
      yield* collectionsByName,
      { 'Loose outfit': [], 'Weekend wear': [], 'Blue and navy': ['Work'] },
      'An outfit can be saved in no collection or leave its last one.',
    );
    yield* changePlanning(clock, { action: 'delete-outfit', id: weekendId });
    yield* changePlanning(clock, { action: 'delete-outfit', id: looseId });
  });
