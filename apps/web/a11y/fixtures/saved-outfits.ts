import {
  type CollectionUpdate,
  collectionsOf,
  removeCollection,
  renameCollection,
  resolveCollections,
} from '#/features/rota/outfit-collections.ts';
import type { PlanningChange } from '#/features/rota/schemas/planning-input.ts';
import type { PlanningView } from '#/features/rota/schemas/planning-view.ts';

type Outfits = PlanningView['outfits'];

const regroup = (
  outfits: Outfits,
  updates: ReadonlyArray<CollectionUpdate>,
): Outfits =>
  outfits.map((outfit) => ({
    ...outfit,
    collections:
      updates.find((update) => update.id === outfit.id)?.collections ??
      outfit.collections,
  }));

/** Applies a saved-outfit change as the server does, without the database. */
export const changeSavedOutfits = (
  outfits: Outfits,
  change: Extract<
    PlanningChange,
    {
      action:
        | 'save-outfit'
        | 'delete-outfit'
        | 'rename-collection'
        | 'delete-collection';
    }
  >,
): Outfits => {
  switch (change.action) {
    case 'save-outfit': {
      const others = outfits.filter((outfit) => outfit.id !== change.id);
      return [
        ...others,
        {
          id: change.id,
          name: change.name,
          entries: change.entries,
          collections: resolveCollections(
            change.collections,
            collectionsOf(others).map((collection) => collection.name),
          ),
        },
      ];
    }
    case 'delete-outfit':
      return outfits.filter((outfit) => outfit.id !== change.id);
    case 'rename-collection':
      return regroup(
        outfits,
        renameCollection(outfits, change.from, change.to),
      );
    default:
      return regroup(outfits, removeCollection(outfits, change.name));
  }
};
