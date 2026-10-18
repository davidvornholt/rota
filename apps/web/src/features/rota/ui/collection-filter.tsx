import { linkButtonClass } from '#/shared/ui/classes.ts';
import type { CollectionCount } from '../outfit-collections.ts';
import { CollectionChip } from './collection-chip.tsx';

/** Narrows the saved outfits to those in every chosen collection. */
export const CollectionFilter = ({
  collections,
  chosen,
  onChange,
  onEdit,
}: {
  readonly collections: ReadonlyArray<CollectionCount>;
  readonly chosen: ReadonlyArray<string>;
  readonly onChange: (chosen: ReadonlyArray<string>) => void;
  readonly onEdit: () => void;
}) => (
  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Filter by collection</legend>
      {collections.map(({ name, count }) => {
        const pressed = chosen.includes(name);
        return (
          <CollectionChip
            key={name}
            name={name}
            count={count}
            pressed={pressed}
            disabled={false}
            onToggle={() =>
              onChange(
                pressed
                  ? chosen.filter((item) => item !== name)
                  : [...chosen, name],
              )
            }
          />
        );
      })}
    </fieldset>
    <div className="flex gap-4">
      {chosen.length === 0 ? null : (
        <button
          className={linkButtonClass}
          onClick={() => onChange([])}
          type="button"
        >
          Show all
        </button>
      )}
      <button className={linkButtonClass} onClick={onEdit} type="button">
        Edit collections
      </button>
    </div>
  </div>
);
