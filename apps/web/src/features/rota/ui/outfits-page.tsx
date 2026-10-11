import { Link } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
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
import type { PlanningView } from '../schemas/planning-view.ts';
import { OutfitFormDialog } from './outfit-form-dialog.tsx';
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
        <h2 className="type-display min-w-0 pt-1 text-2xl" id={nameId}>
          {outfit.name}
        </h2>
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

/** Saved outfits as collages, to choose for a day, edit, share or delete. */
export const OutfitsPage = ({
  initial,
}: {
  readonly initial: PlanningView;
}) => {
  const { view, busy, change } = usePlanningChange(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const count = view.outfits.length;
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
            {count} saved outfit{count === 1 ? '' : 's'}
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
              outfit: { id: crypto.randomUUID(), name: '', entries: [] },
            });
          }}
        >
          Create outfit
        </button>
      </div>
      {error === '' ? null : (
        <Notice className="mt-5" live={true}>
          {error}
        </Notice>
      )}
      <p className="mt-3 text-ink-muted text-sm" role="status">
        {message}
      </p>
      {count === 0 ? (
        <p className="mt-5 text-ink-muted">
          Save combinations you like, then wear them any day.
        </p>
      ) : (
        <ul className="mt-5 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {view.outfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              view={view}
              busy={busy}
              confirming={confirming === outfit.id}
              onEdit={() => {
                setMessage('');
                setEditing({ title: `Edit ${outfit.name}`, outfit });
              }}
              onAskDelete={() => setConfirming(outfit.id)}
              onDelete={() => {
                remove(outfit).catch(() => undefined);
              }}
              onKeep={() => setConfirming(null)}
            />
          ))}
        </ul>
      )}
      {editing === null ? null : (
        <OutfitFormDialog
          title={editing.title}
          outfit={editing.outfit}
          wardrobe={view.wardrobe}
          busy={busy}
          onSave={async (outfit) => {
            await change({ action: 'save-outfit', ...outfit });
            setMessage(`Saved ${outfit.name.trim()}.`);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
