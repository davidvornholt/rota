/**
 * Collections are the wearer's own groups of saved outfits, such as an
 * occasion or a season. An outfit can be in several, and a collection exists
 * while an outfit is in it. Names are compared without case, so "arbeit"
 * joins an existing "Arbeit" instead of starting a second collection.
 */

import type { SavedOutfit } from '#/shared/data/outfit.ts';

export const collectionNameLength = 40;
export const collectionsPerOutfit = 12;

export type CollectionCount = {
  readonly name: string;
  readonly count: number;
};

export const tidyCollection = (name: string): string =>
  name.trim().replace(/\s+/gu, ' ');

const keyOf = (name: string) => tidyCollection(name).toLocaleLowerCase();

const byName = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: 'base' });

/** Every collection with the number of outfits in it, by name. */
export const collectionsOf = (
  outfits: ReadonlyArray<SavedOutfit>,
): ReadonlyArray<CollectionCount> => {
  const counts = new Map<string, number>();
  for (const name of outfits.flatMap((outfit) => outfit.collections)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => byName(left.name, right.name));
};

/**
 * The collections an outfit is in: tidied, without blanks or repeats, spelled
 * the way an existing collection already is, and sorted by name.
 */
export const resolveCollections = (
  names: ReadonlyArray<string>,
  existing: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const spelling = new Map(existing.map((name) => [keyOf(name), name]));
  const chosen = new Map<string, string>();
  for (const name of names.map(tidyCollection)) {
    const key = keyOf(name);
    if (name !== '' && !chosen.has(key)) {
      chosen.set(key, spelling.get(key) ?? name);
    }
  }
  return [...chosen.values()].sort(byName);
};

/** Whether the outfit is in every chosen collection; choosing none shows all. */
export const inEveryCollection = (
  outfit: SavedOutfit,
  chosen: ReadonlyArray<string>,
): boolean => chosen.every((name) => outfit.collections.includes(name));

export type CollectionUpdate = {
  readonly id: string;
  readonly collections: ReadonlyArray<string>;
};

/** Renaming into an existing collection merges the two. */
export const renameCollection = (
  outfits: ReadonlyArray<SavedOutfit>,
  from: string,
  to: string,
): ReadonlyArray<CollectionUpdate> => {
  const others = collectionsOf(outfits)
    .map((collection) => collection.name)
    .filter((name) => name !== from);
  return outfits
    .filter((outfit) => outfit.collections.includes(from))
    .map((outfit) => ({
      id: outfit.id,
      collections: resolveCollections(
        outfit.collections.map((name) => (name === from ? to : name)),
        others,
      ),
    }));
};

/** Removing a collection keeps its outfits. */
export const removeCollection = (
  outfits: ReadonlyArray<SavedOutfit>,
  name: string,
): ReadonlyArray<CollectionUpdate> =>
  outfits
    .filter((outfit) => outfit.collections.includes(name))
    .map((outfit) => ({
      id: outfit.id,
      collections: outfit.collections.filter((item) => item !== name),
    }));
