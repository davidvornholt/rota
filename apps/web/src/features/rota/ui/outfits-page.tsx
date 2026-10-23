import { type RefObject, useRef, useState } from 'react';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { frameClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { collectionsOf, resolveCollections } from '../outfit-collections.ts';
import {
  activeFilter,
  matchesFilter,
  noFilter,
  type OutfitFilter,
} from '../outfit-filter.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { CollectionsDialog } from './collections-dialog.tsx';
import { OutfitFilterRow } from './outfit-filter-row.tsx';
import { OutfitFormDialog } from './outfit-form-dialog.tsx';
import { OutfitList } from './outfit-list.tsx';
import { useFocusFallback } from './use-focus-fallback.ts';
import { usePlanningChange } from './use-planning-change.ts';

type Editing = { readonly title: string; readonly outfit: SavedOutfit };

const failureMessage = (failure: unknown) =>
  failure instanceof Error ? failure.message : 'Could not save. Try again.';

/** Renames and deletes collections, and keeps a filter on them in step. */
const useCollectionChanges = (
  change: (input: PlanningChange) => Promise<PlanningView>,
  filter: OutfitFilter,
  onFilter: (filter: OutfitFilter) => void,
) => {
  const renameCollection = async (from: string, to: string) => {
    const next = await change({ action: 'rename-collection', from, to });
    const [renamed = to] = resolveCollections(
      [to],
      collectionsOf(next.outfits).map((collection) => collection.name),
    );
    if (filter.collections.includes(from)) {
      onFilter({
        ...filter,
        collections: [
          ...new Set(
            filter.collections.map((name) => (name === from ? renamed : name)),
          ),
        ],
      });
    }
    return renamed;
  };
  const removeCollection = async (name: string) => {
    await change({ action: 'delete-collection', name });
    if (filter.collections.includes(name)) {
      onFilter({
        ...filter,
        collections: filter.collections.filter((item) => item !== name),
      });
    }
  };
  return { renameCollection, removeCollection };
};

/**
 * Opens the collections dialog. Deleting the last collection removes the
 * button that opened it, so closing then lands on the page heading instead.
 */
const useManaging = (headingRef: RefObject<HTMLHeadingElement | null>) => {
  const [isOpen, setOpen] = useState(false);
  useFocusFallback(isOpen, headingRef);
  return { isOpen, open: () => setOpen(true), close: () => setOpen(false) };
};

/** The page's last outcome: a status to announce, or an error to show. */
const useOutcome = () => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const report = (action: () => Promise<string>) => {
    setError('');
    setMessage('');
    action().then(setMessage, (failure: unknown) =>
      setError(failureMessage(failure)),
    );
  };
  return { error, message, setMessage, report };
};

/**
 * Marks or unmarks a favourite. Unmarking one under the favourites filter
 * removes its card, so focus moves to the page heading. Once no favourite is
 * shown, the filter drops favourites, so marking one later does not suddenly
 * narrow the list.
 */
const toggleFavourite = async (
  outfit: SavedOutfit,
  {
    change,
    filter,
    active,
    onFilter,
    headingRef,
  }: {
    readonly change: (input: PlanningChange) => Promise<PlanningView>;
    readonly filter: OutfitFilter;
    readonly active: OutfitFilter;
    readonly onFilter: (filter: OutfitFilter) => void;
    readonly headingRef: RefObject<HTMLHeadingElement | null>;
  },
) => {
  const favourite = !outfit.favourite;
  const next = await change({
    action: 'favourite-outfit',
    id: outfit.id,
    favourite,
  });
  const showsFavourites =
    active.favourites && next.outfits.some((item) => item.favourite);
  if (showsFavourites && !favourite) {
    headingRef.current?.focus();
  }
  if (filter.favourites && !showsFavourites) {
    onFilter({ ...filter, favourites: false });
  }
  return favourite
    ? `Added ${outfit.name} to favourites.`
    : `Removed ${outfit.name} from favourites.`;
};

const countLabel = (shown: number, count: number) =>
  shown === count
    ? `${count} saved outfit${count === 1 ? '' : 's'}`
    : `${shown} of ${count} saved outfits`;

/** The heading takes focus when an action removes the focused control. */
const OutfitsHeader = ({
  headingRef,
  count,
  busy,
  onCreate,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly count: string;
  readonly busy: boolean;
  readonly onCreate: () => void;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-rule border-b pb-4">
    <div>
      <h1
        className="type-display text-4xl text-ink sm:text-5xl"
        ref={headingRef}
        tabIndex={-1}
      >
        Outfits
      </h1>
      <p className="type-data mt-1 text-ink-muted text-sm">{count}</p>
    </div>
    <button
      className={signalButtonClass}
      disabled={busy}
      type="button"
      onClick={onCreate}
    >
      Create outfit
    </button>
  </div>
);

/**
 * Saved outfits as collages, to choose for a day, mark as a favourite, edit,
 * share or delete. The filter lives in the address, so going back keeps it.
 */
export const OutfitsPage = ({
  initial,
  filter,
  onFilter,
}: {
  readonly initial: PlanningView;
  readonly filter: OutfitFilter;
  readonly onFilter: (filter: OutfitFilter) => void;
}) => {
  const { view, busy, change } = usePlanningChange(initial);
  const { renameCollection, removeCollection } = useCollectionChanges(
    change,
    filter,
    onFilter,
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { error, message, setMessage, report } = useOutcome();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Saving an outfit out of the filter removes the card that opened its dialog.
  useFocusFallback(editing !== null, headingRef);
  const collections = collectionsOf(view.outfits);
  const favourites = view.outfits.filter((outfit) => outfit.favourite).length;
  const managing = useManaging(headingRef);
  const active = activeFilter(view.outfits, filter);
  const shown = view.outfits.filter((outfit) => matchesFilter(outfit, active));
  const remove = (outfit: SavedOutfit) =>
    report(async () => {
      await change({ action: 'delete-outfit', id: outfit.id });
      setConfirming(null);
      // The card that held focus is gone.
      headingRef.current?.focus();
      return `Deleted ${outfit.name}.`;
    });
  // Show all removes the button that was pressed.
  const showAll = () => {
    onFilter(noFilter);
    headingRef.current?.focus();
  };
  return (
    <div className={frameClass}>
      <OutfitsHeader
        headingRef={headingRef}
        count={countLabel(shown.length, view.outfits.length)}
        busy={busy}
        onCreate={() => {
          setMessage('');
          setEditing({
            title: 'Create outfit',
            // A new outfit starts in the filter being looked at.
            outfit: {
              id: crypto.randomUUID(),
              name: '',
              entries: [],
              collections: active.collections,
              favourite: active.favourites,
            },
          });
        }}
      />
      {collections.length === 0 && favourites === 0 ? null : (
        <OutfitFilterRow
          favourites={favourites}
          collections={collections}
          filter={active}
          onChange={onFilter}
          onShowAll={showAll}
          onEdit={managing.open}
        />
      )}
      {error === '' ? null : (
        <Notice className="mt-5" live={true}>
          {error}
        </Notice>
      )}
      <p className="mt-3 text-ink-muted text-sm" role="status">
        {message}
      </p>
      <OutfitList
        outfits={shown}
        filter={active}
        view={view}
        busy={busy}
        confirming={confirming}
        onFavourite={(outfit) =>
          report(() =>
            toggleFavourite(outfit, {
              change,
              filter,
              active,
              onFilter,
              headingRef,
            }),
          )
        }
        onEdit={(outfit) => {
          setMessage('');
          setEditing({ title: `Edit ${outfit.name}`, outfit });
        }}
        onAskDelete={setConfirming}
        onDelete={remove}
        onShowAll={showAll}
      />
      {editing === null ? null : (
        <OutfitFormDialog
          title={editing.title}
          outfit={editing.outfit}
          collections={collections.map((collection) => collection.name)}
          wardrobe={view.wardrobe}
          busy={busy}
          onSave={async (outfit) => {
            await change({ action: 'save-outfit', ...outfit });
            setMessage(`Saved ${outfit.name.trim()}.`);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {managing.isOpen ? (
        <CollectionsDialog
          collections={collections}
          busy={busy}
          onRename={renameCollection}
          onRemove={removeCollection}
          onClose={managing.close}
        />
      ) : null}
    </div>
  );
};
