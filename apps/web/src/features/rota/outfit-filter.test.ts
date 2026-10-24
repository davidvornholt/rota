import { describe, expect, it } from 'bun:test';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { activeFilter, matchesFilter } from './outfit-filter.ts';

const outfit = (
  id: string,
  favourite: boolean,
  collections: ReadonlyArray<string>,
): SavedOutfit => ({ id, name: id, entries: [], collections, favourite });

const outfits = [
  outfit('liked-work', true, ['Work']),
  outfit('liked', true, []),
  outfit('work', false, ['Work', 'Summer']),
];

describe('activeFilter', () => {
  it('keeps favourites and collections that still have outfits', () => {
    expect(
      activeFilter(outfits, { favourites: true, collections: ['Work'] }),
    ).toEqual({ favourites: true, collections: ['Work'] });
  });

  it('drops favourites once none is left, and collections no outfit is in', () => {
    expect(
      activeFilter(
        outfits.map((item) => ({ ...item, favourite: false })),
        { favourites: true, collections: ['Weekend', 'Summer'] },
      ),
    ).toEqual({ favourites: false, collections: ['Summer'] });
  });
});

describe('matchesFilter', () => {
  const shown = (favourites: boolean, collections: ReadonlyArray<string>) =>
    outfits
      .filter((item) => matchesFilter(item, { favourites, collections }))
      .map((item) => item.id);

  it('shows every outfit without a filter', () => {
    expect(shown(false, [])).toEqual(['liked-work', 'liked', 'work']);
  });

  it('narrows to favourites, and to favourites in every chosen collection', () => {
    expect(shown(true, [])).toEqual(['liked-work', 'liked']);
    expect(shown(true, ['Work'])).toEqual(['liked-work']);
    expect(shown(true, ['Work', 'Summer'])).toEqual([]);
  });
});
