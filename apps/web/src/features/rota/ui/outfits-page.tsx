import { Link } from '@tanstack/react-router';
import { type RefObject, useId, useRef, useState } from 'react';
import {
  collageEntries,
  collageLabel,
} from '#/shared/collage/collage-entries.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { addDays } from '#/shared/time/local-date.ts';
import {
  frameClass,
  linkButtonClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { OutfitCollage } from '#/shared/ui/outfit-collage.tsx';
import { ShareOutfitButton } from '#/shared/ui/share-outfit-dialog.tsx';
import {
  collectionsOf,
  inEveryCollection,
  resolveCollections,
} from '../outfit-collections.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { CollectionFilter } from './collection-filter.tsx';
import { CollectionsDialog } from './collections-dialog.tsx';
import { OutfitFormDialog } from './outfit-form-dialog.tsx';
import { useFocusFallback } from './use-focus-fallback.ts';
import { usePlanningChange } from './use-planning-change.ts';

type Editing = { readonly title: string; readonly outfit: SavedOutfit };

const failureMessage = (failure: unknown) =>
  failure instanceof Error ? failure.message : 'Could not save. Try again.';

const OutfitCard = ({
  outfit,
  view,
  busy,
  confirming,
  onEdit,
  onAskDelete,
  onDelete,
  onKeep,
}: {
  readonly outfit: SavedOutfit;
  readonly view: PlanningView;
  readonly busy: boolean;
  readonly confirming: boolean;
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
const OutfitList = ({
  outfits,
  chosen,
  view,
  busy,
  confirming,
  onEdit,
  onAskDelete,
  onDelete,
  onShowAll,
}: {
  readonly outfits: ReadonlyArray<SavedOutfit>;
  readonly chosen: ReadonlyArray<string>;
  readonly view: PlanningView;
  readonly busy: boolean;
  readonly confirming: string | null;
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
        No saved outfit is in {chosen.join(' and ')}.{' '}
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
          onEdit={() => onEdit(outfit)}
          onAskDelete={() => onAskDelete(outfit.id)}
          onDelete={() => onDelete(outfit)}
          onKeep={() => onAskDelete(null)}
        />
      ))}
    </ul>
  );
};

/** Renames and deletes collections, and keeps a filter on them in step. */
const useCollectionChanges = (
  change: (input: PlanningChange) => Promise<PlanningView>,
  filter: ReadonlyArray<string>,
  onFilter: (filter: ReadonlyArray<string>) => void,
) => {
  const renameCollection = async (from: string, to: string) => {
    const next = await change({ action: 'rename-collection', from, to });
    const [renamed = to] = resolveCollections(
      [to],
      collectionsOf(next.outfits).map((collection) => collection.name),
    );
    if (filter.includes(from)) {
      onFilter([
        ...new Set(filter.map((name) => (name === from ? renamed : name))),
      ]);
    }
    return renamed;
  };
  const removeCollection = async (name: string) => {
    await change({ action: 'delete-collection', name });
    if (filter.includes(name)) {
      onFilter(filter.filter((item) => item !== name));
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

const countLabel = (shown: number, count: number) =>
  shown === count
    ? `${count} saved outfit${count === 1 ? '' : 's'}`
    : `${shown} of ${count} saved outfits`;

/**
 * Saved outfits as collages, to choose for a day, edit, share or delete. The
 * chosen collections live in the address, so going back keeps the filter.
 */
export const OutfitsPage = ({
  initial,
  filter,
  onFilter,
}: {
  readonly initial: PlanningView;
  readonly filter: ReadonlyArray<string>;
  readonly onFilter: (filter: ReadonlyArray<string>) => void;
}) => {
  const { view, busy, change } = usePlanningChange(initial);
  const { renameCollection, removeCollection } = useCollectionChanges(
    change,
    filter,
    onFilter,
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Saving an outfit out of the filter removes the card that opened its dialog.
  useFocusFallback(editing !== null, headingRef);
  const collections = collectionsOf(view.outfits);
  const managing = useManaging(headingRef);
  const names = collections.map((collection) => collection.name);
  // A collection renamed or emptied elsewhere drops out of the filter.
  const chosen = filter.filter((name) => names.includes(name));
  const shown = view.outfits.filter((outfit) =>
    inEveryCollection(outfit, chosen),
  );
  const remove = async (outfit: SavedOutfit) => {
    setError('');
    setMessage('');
    try {
      await change({ action: 'delete-outfit', id: outfit.id });
      setConfirming(null);
      setMessage(`Deleted ${outfit.name}.`);
      // The card that held focus is gone.
      headingRef.current?.focus();
    } catch (failure) {
      setError(failureMessage(failure));
    }
  };
  // Show all removes the button that was pressed.
  const showAll = () => {
    onFilter([]);
    headingRef.current?.focus();
  };
  return (
    <div className={frameClass}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-rule border-b pb-4">
        <div>
          <h1
            className="type-display text-4xl text-ink sm:text-5xl"
            ref={headingRef}
            tabIndex={-1}
          >
            Outfits
          </h1>
          <p className="type-data mt-1 text-ink-muted text-sm">
            {countLabel(shown.length, view.outfits.length)}
          </p>
        </div>
        <button
          className={signalButtonClass}
          disabled={busy}
          type="button"
          onClick={() => {
            setMessage('');
            setEditing({
              title: 'Create outfit',
              // A new outfit starts in the collections being looked at.
              outfit: {
                id: crypto.randomUUID(),
                name: '',
                entries: [],
                collections: chosen,
              },
            });
          }}
        >
          Create outfit
        </button>
      </div>
      {collections.length === 0 ? null : (
        <CollectionFilter
          collections={collections}
          chosen={chosen}
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
        chosen={chosen}
        view={view}
        busy={busy}
        confirming={confirming}
        onEdit={(outfit) => {
          setMessage('');
          setEditing({ title: `Edit ${outfit.name}`, outfit });
        }}
        onAskDelete={setConfirming}
        onDelete={(outfit) => {
          remove(outfit).catch(() => undefined);
        }}
        onShowAll={showAll}
      />
      {editing === null ? null : (
        <OutfitFormDialog
          title={editing.title}
          outfit={editing.outfit}
          collections={names}
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
