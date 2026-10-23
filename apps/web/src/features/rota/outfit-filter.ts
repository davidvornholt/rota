import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { collectionsOf, inEveryCollection } from './outfit-collections.ts';

/** What the saved outfits are narrowed to; the address keeps it. */
export type OutfitFilter = {
  readonly favourites: boolean;
  readonly collections: ReadonlyArray<string>;
};

export const noFilter: OutfitFilter = { favourites: false, collections: [] };

/**
 * The part of a filter that still applies: favourites while there is one, and
 * each collection while an outfit is in it. A favourite or collection removed
 * elsewhere then drops out instead of hiding every outfit.
 */
export const activeFilter = (
  outfits: ReadonlyArray<SavedOutfit>,
  filter: OutfitFilter,
): OutfitFilter => {
  const names = collectionsOf(outfits).map((collection) => collection.name);
  return {
    favourites: filter.favourites && outfits.some((outfit) => outfit.favourite),
    collections: filter.collections.filter((name) => names.includes(name)),
  };
};

export const matchesFilter = (
  outfit: SavedOutfit,
  filter: OutfitFilter,
): boolean =>
  (!filter.favourites || outfit.favourite) &&
  inEveryCollection(outfit, filter.collections);
