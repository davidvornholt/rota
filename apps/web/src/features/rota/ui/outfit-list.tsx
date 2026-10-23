import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import {
  collageEntries,
  collageLabel,
} from '#/shared/collage/collage-entries.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { addDays } from '#/shared/time/local-date.ts';
import { linkButtonClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { OutfitCollage } from '#/shared/ui/outfit-collage.tsx';
import { ShareOutfitButton } from '#/shared/ui/share-outfit-dialog.tsx';
import type { OutfitFilter } from '../outfit-filter.ts';
import type { PlanningView } from '../schemas/planning-view.ts';

const OutfitCard = ({
  outfit,
  view,
  busy,
  confirming,
  onFavourite,
  onEdit,
  onAskDelete,
  onDelete,
  onKeep,
}: {
  readonly outfit: SavedOutfit;
  readonly view: PlanningView;
  readonly busy: boolean;
  readonly confirming: boolean;
  readonly onFavourite: () => void;
  readonly onEdit: () => void;
  readonly onAskDelete: () => void;
  readonly onDelete: () => void;
  readonly onKeep: () => void;
}) => {
  const nameId = useId();
  const entries = collageEntries(outfit.entries, view.wardrobe);
  // Choosing opens Today with the outfit, which plans it for that day.
  const days = [
    ...(view.day.worn === null
      ? [{ label: 'Choose for today', date: view.actualToday }]
      : []),
    { label: 'Choose for tomorrow', date: addDays(view.actualToday, 1) },
  ];
  return (
    <li>
      <OutfitCollage
        entries={entries}
        label={collageLabel(outfit.name, entries)}
        width="min(100vw - 2.5rem, 28rem)"
      />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0 pt-1">
          <h2 className="type-display text-2xl" id={nameId}>
            {outfit.name}
          </h2>
          {outfit.collections.length === 0 ? null : (
            <p className="mt-1 text-ink-muted text-sm">
              {outfit.collections.join(' · ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0">
          <IconButton
            icon="heart"
            label={`Favourite ${outfit.name}`}
            tooltip={
              outfit.favourite ? 'Remove from favourites' : 'Add to favourites'
            }
            pressed={outfit.favourite}
            disabled={busy}
            onClick={onFavourite}
          />
          <IconButton
            icon="edit"
            label={`Edit ${outfit.name}`}
            disabled={busy}
            onClick={onEdit}
          />
          <ShareOutfitButton
            entries={entries}
            label={`Share ${outfit.name} as picture`}
            title={outfit.name}
          />
          <IconButton
            icon="trash"
            label={`Delete ${outfit.name}`}
            disabled={busy}
            onClick={onAskDelete}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {days.map(({ label, date }) => (
          <Link
            aria-describedby={nameId}
            className={quietButtonClass}
            disabled={busy}
            key={label}
            search={{ date, outfit: outfit.id }}
            to="/"
          >
            {label}
          </Link>
        ))}
      </div>
      {confirming ? (
        <div className="mt-2 flex items-center gap-4">
          <span className="text-sm">Delete this saved outfit?</span>
          <button
            className={linkButtonClass}
            disabled={busy}
            type="button"
            onClick={onDelete}
          >
            Delete outfit
          </button>
          <button className={linkButtonClass} type="button" onClick={onKeep}>
            Cancel
          </button>
        </div>
      ) : null}
    </li>
  );
};

/** The outfits the filter shows, or why there are none. */
export const OutfitList = ({
  outfits,
  filter,
  view,
  busy,
  confirming,
  onFavourite,
  onEdit,
  onAskDelete,
  onDelete,
  onShowAll,
}: {
  readonly outfits: ReadonlyArray<SavedOutfit>;
  readonly filter: OutfitFilter;
  readonly view: PlanningView;
  readonly busy: boolean;
  readonly confirming: string | null;
  readonly onFavourite: (outfit: SavedOutfit) => void;
  readonly onEdit: (outfit: SavedOutfit) => void;
  readonly onAskDelete: (id: string | null) => void;
  readonly onDelete: (outfit: SavedOutfit) => void;
  readonly onShowAll: () => void;
}) => {
  if (view.outfits.length === 0) {
    return (
      <p className="mt-5 text-ink-muted">
        Save combinations you like, then wear them any day.
      </p>
    );
  }
  if (outfits.length === 0) {
    return (
      <p className="mt-5 text-ink-muted">
        {/* Favourites alone always show one, so collections are chosen. */}
        No {filter.favourites ? 'favourite' : 'saved outfit'} is in{' '}
        {filter.collections.join(' and ')}.{' '}
        <button className={linkButtonClass} onClick={onShowAll} type="button">
          Show all
        </button>
      </p>
    );
  }
  return (
    <ul className="mt-5 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map((outfit) => (
        <OutfitCard
          key={outfit.id}
          outfit={outfit}
          view={view}
          busy={busy}
          confirming={confirming === outfit.id}
          onFavourite={() => onFavourite(outfit)}
          onEdit={() => onEdit(outfit)}
          onAskDelete={() => onAskDelete(outfit.id)}
          onDelete={() => onDelete(outfit)}
          onKeep={() => onAskDelete(null)}
        />
      ))}
    </ul>
  );
};
