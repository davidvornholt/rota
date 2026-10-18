// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { changePlanning } from '#/features/rota/services/planning-service.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

const weekendId = '55555555-5555-4555-8555-555555555555';

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
    yield* changePlanning(clock, { action: 'delete-outfit', id: weekendId });
  });
