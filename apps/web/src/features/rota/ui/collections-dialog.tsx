import { useId, useRef, useState } from 'react';
import {
  fieldClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { ConfirmButton } from '#/shared/ui/confirm-button.tsx';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import {
  type CollectionCount,
  collectionNameLength,
  tidyCollection,
} from '../outfit-collections.ts';

const outfitCount = (count: number) =>
  `${count} outfit${count === 1 ? '' : 's'}`;

const CollectionRow = ({
  collection,
  busy,
  onRename,
  onRemove,
}: {
  readonly collection: CollectionCount;
  readonly busy: boolean;
  readonly onRename: (to: string) => void;
  readonly onRemove: () => void;
}) => {
  const inputId = useId();
  const countId = useId();
  const [name, setName] = useState(collection.name);
  const to = tidyCollection(name);
  return (
    <li className="border-rule border-t py-4">
      <form
        className="flex flex-wrap items-center gap-x-2 gap-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (to !== '' && to !== collection.name) {
            onRename(to);
          }
        }}
      >
        <div className="min-w-0 flex-1 basis-40">
          <label className="sr-only" htmlFor={inputId}>
            Name of {collection.name}
          </label>
          <input
            aria-describedby={countId}
            className={fieldClass}
            disabled={busy}
            id={inputId}
            maxLength={collectionNameLength}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <p className="type-data mt-1 text-ink-muted text-xs" id={countId}>
            {outfitCount(collection.count)}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            className={quietButtonClass}
            disabled={busy || to === '' || to === collection.name}
            type="submit"
          >
            Rename
          </button>
          <ConfirmButton
            label={`Delete ${collection.name}`}
            confirmLabel={`Remove from ${outfitCount(collection.count)}`}
            disabled={busy}
            onConfirm={onRemove}
            tone="link"
          />
        </div>
      </form>
    </li>
  );
};

/**
 * Renames or deletes collections across every outfit in them. Renaming into an
 * existing collection merges the two; deleting one keeps its outfits.
 */
export const CollectionsDialog = ({
  collections,
  busy,
  onRename,
  onRemove,
  onClose,
}: {
  readonly collections: ReadonlyArray<CollectionCount>;
  readonly busy: boolean;
  readonly onRename: (from: string, to: string) => Promise<string>;
  readonly onRemove: (name: string) => Promise<unknown>;
  readonly onClose: () => void;
}) => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const run = (action: () => Promise<string>) => {
    setError('');
    setMessage('');
    action()
      .then((done) => {
        setMessage(done);
        // The row that held focus is replaced or gone.
        statusRef.current?.focus();
      })
      .catch((failure: unknown) =>
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not save. Try again.',
        ),
      );
  };
  return (
    <Dialog
      open={true}
      title="Edit collections"
      onClose={busy ? () => undefined : onClose}
    >
      <p className="text-ink-muted text-sm">
        Renaming a collection changes it on every outfit in it, and renaming it
        to another collection’s name merges the two. Deleting a collection keeps
        its outfits.
      </p>
      {error === '' ? null : (
        <Notice className="mt-4" live={true}>
          {error}
        </Notice>
      )}
      <p
        className="mt-3 min-h-5 text-sm outline-none"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {message}
      </p>
      {collections.length === 0 ? (
        <p className="mt-3 text-ink-muted">No collections left.</p>
      ) : (
        <ul className="mt-3 border-rule border-b">
          {collections.map((collection) => (
            <CollectionRow
              key={collection.name}
              collection={collection}
              busy={busy}
              onRename={(to) =>
                run(async () => {
                  const renamed = await onRename(collection.name, to);
                  return `Renamed ${collection.name} to ${renamed}.`;
                })
              }
              onRemove={() =>
                run(async () => {
                  await onRemove(collection.name);
                  return `Deleted ${collection.name}. Its outfits stay.`;
                })
              }
            />
          ))}
        </ul>
      )}
      <button
        className={[linkButtonClass, 'mt-4'].join(' ')}
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        Done
      </button>
    </Dialog>
  );
};
