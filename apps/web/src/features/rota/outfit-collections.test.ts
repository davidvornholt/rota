import { describe, expect, it } from 'bun:test';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import {
  collectionsOf,
  inEveryCollection,
  removeCollection,
  renameCollection,
  resolveCollections,
} from './outfit-collections.ts';

const outfit = (
  id: string,
  collections: ReadonlyArray<string>,
): SavedOutfit => ({
  id,
  name: id,
  entries: [],
  collections,
  favourite: false,
});

const outfits = [
  outfit('summer-work', ['Summer', 'Work']),
  outfit('spring-work', ['Spring', 'Work']),
  outfit('weekend', ['Freizeit']),
  outfit('loose', []),
];

describe('outfit collections', () => {
  it('counts outfits per collection in name order', () => {
    expect(collectionsOf(outfits)).toEqual([
      { name: 'Freizeit', count: 1 },
      { name: 'Spring', count: 1 },
      { name: 'Summer', count: 1 },
      { name: 'Work', count: 2 },
    ]);
  });

  it('tidies names, drops repeats and blanks, and reuses existing spelling', () => {
    expect(
      resolveCollections(
        ['  work ', 'Work', 'Late   summer', '', '  ', 'FREIZEIT'],
        ['Work', 'Freizeit'],
      ),
    ).toEqual(['Freizeit', 'Late summer', 'Work']);
  });

  it('shows outfits in every chosen collection, or all when none is chosen', () => {
    const shown = (chosen: ReadonlyArray<string>) =>
      outfits
        .filter((item) => inEveryCollection(item, chosen))
        .map((item) => item.id);
    expect(shown([])).toEqual(outfits.map((item) => item.id));
    expect(shown(['Work'])).toEqual(['summer-work', 'spring-work']);
    expect(shown(['Work', 'Summer'])).toEqual(['summer-work']);
    expect(shown(['Work', 'Freizeit'])).toEqual([]);
  });

  it('renames a collection only in the outfits that are in it', () => {
    expect(renameCollection(outfits, 'Work', 'Office')).toEqual([
      { id: 'summer-work', collections: ['Office', 'Summer'] },
      { id: 'spring-work', collections: ['Office', 'Spring'] },
    ]);
  });

  it('merges a renamed collection into an existing one', () => {
    expect(renameCollection(outfits, 'Spring', 'summer')).toEqual([
      { id: 'spring-work', collections: ['Summer', 'Work'] },
    ]);
    expect(renameCollection(outfits, 'Summer', 'WORK')).toEqual([
      { id: 'summer-work', collections: ['Work'] },
    ]);
  });

  it('can change only the case of a collection', () => {
    expect(renameCollection(outfits, 'Freizeit', 'freizeit')).toEqual([
      { id: 'weekend', collections: ['freizeit'] },
    ]);
  });

  it('removes a collection and keeps its outfits', () => {
    expect(removeCollection(outfits, 'Work')).toEqual([
      { id: 'summer-work', collections: ['Summer'] },
      { id: 'spring-work', collections: ['Spring'] },
    ]);
  });
});
