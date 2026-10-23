// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { changePlanning } from '#/features/rota/services/planning-service.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

const weekendId = '66666666-6666-4666-8666-666666666666';

/**
 * Starts from the only saved outfit, "Blue and navy", which is not a
 * favourite, and leaves it marked as one.
 */
export const verifyFavourites = (
  clock: WardrobeClock,
  entries: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const outfits = yield* OutfitRepository;
    const favourites = Effect.map(outfits.list(), (list) =>
      list.map((item) => [item.name, item.favourite]),
    );
    const [saved] = yield* outfits.list();
    assert(saved);
    assert.deepEqual(yield* favourites, [['Blue and navy', false]]);
    yield* changePlanning(clock, {
      action: 'save-outfit',
      id: weekendId,
      name: 'Weekend wear',
      entries,
      collections: [],
      favourite: true,
    });
    yield* changePlanning(clock, {
      action: 'favourite-outfit',
      id: saved.id,
      favourite: true,
    });
    assert.deepEqual(
      yield* favourites,
      [
        ['Weekend wear', true],
        ['Blue and navy', true],
      ],
      'Marking a favourite keeps the outfits in their order.',
    );
    yield* changePlanning(clock, {
      action: 'save-outfit',
      id: saved.id,
      name: saved.name,
      entries: saved.entries,
      collections: saved.collections,
      favourite: false,
    });
    assert.deepEqual(
      yield* favourites,
      [
        ['Blue and navy', true],
        ['Weekend wear', true],
      ],
      'Editing an outfit keeps its favourite mark.',
    );
    yield* changePlanning(clock, {
      action: 'favourite-outfit',
      id: weekendId,
      favourite: false,
    });
    assert.deepEqual(yield* favourites, [
      ['Blue and navy', true],
      ['Weekend wear', false],
    ]);
    yield* changePlanning(clock, { action: 'delete-outfit', id: weekendId });
  });
