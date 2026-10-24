import { linkButtonClass } from '#/shared/ui/classes.ts';
import type { CollectionCount } from '../outfit-collections.ts';
import type { OutfitFilter } from '../outfit-filter.ts';
import { CollectionChip } from './collection-chip.tsx';

/**
 * Narrows the saved outfits to favourites, to those in every chosen
 * collection, or to both. Favourites appear once an outfit is one.
 */
export const OutfitFilterRow = ({
  favourites,
  collections,
  filter,
  onChange,
  onShowAll,
  onEdit,
}: {
  readonly favourites: number;
  readonly collections: ReadonlyArray<CollectionCount>;
  readonly filter: OutfitFilter;
  readonly onChange: (filter: OutfitFilter) => void;
  readonly onShowAll: () => void;
  readonly onEdit: () => void;
}) => (
  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Filter outfits</legend>
      {favourites === 0 ? null : (
        <CollectionChip
          name="Favourites"
          count={favourites}
          pressed={filter.favourites}
          disabled={false}
          heart={true}
          onToggle={() =>
            onChange({ ...filter, favourites: !filter.favourites })
          }
        />
      )}
      {collections.map(({ name, count }) => {
        const pressed = filter.collections.includes(name);
        return (
          <CollectionChip
            key={name}
            name={name}
            count={count}
            pressed={pressed}
            disabled={false}
            onToggle={() =>
              onChange({
                ...filter,
                collections: pressed
                  ? filter.collections.filter((item) => item !== name)
                  : [...filter.collections, name],
              })
            }
          />
        );
      })}
    </fieldset>
    <div className="flex gap-4">
      {filter.favourites || filter.collections.length > 0 ? (
        <button className={linkButtonClass} onClick={onShowAll} type="button">
          Show all
        </button>
      ) : null}
      {collections.length === 0 ? null : (
        <button className={linkButtonClass} onClick={onEdit} type="button">
          Edit collections
        </button>
      )}
    </div>
  </div>
);
