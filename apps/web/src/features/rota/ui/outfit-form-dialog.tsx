import { useState } from 'react';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import {
  fieldClass,
  linkButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { OutfitEditor } from './outfit-editor.tsx';

/** Names and edits a saved outfit; `onSave` stores it and `onClose` follows. */
export const OutfitFormDialog = ({
  title,
  outfit,
  wardrobe,
  busy,
  onSave,
  onClose,
}: {
  readonly title: string;
  readonly outfit: SavedOutfit;
  readonly wardrobe: ReadonlyArray<GarmentView>;
  readonly busy: boolean;
  readonly onSave: (outfit: SavedOutfit) => Promise<unknown>;
  readonly onClose: () => void;
}) => {
  const [editing, setEditing] = useState(outfit);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    try {
      await onSave(editing);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save. Try again.',
      );
    }
  };
  return (
    <Dialog
      open={true}
      title={title}
      onClose={busy ? () => undefined : onClose}
      size="wide"
    >
      {error === '' ? null : <Notice live={true}>{error}</Notice>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save().catch(() => undefined);
        }}
      >
        <p className="mb-4 text-ink-muted text-sm">
          Keep this combination to choose again on any day. Your daily plan is
          saved separately.
        </p>
        <label className="block text-sm">
          Outfit name
          <input
            className={[fieldClass, 'mt-2 mb-6'].join(' ')}
            value={editing.name}
            onChange={(event) => {
              const name = event.target.value;
              setEditing((current) => ({ ...current, name }));
            }}
            maxLength={80}
            required={true}
          />
        </label>
        <OutfitEditor
          entries={editing.entries}
          wardrobe={wardrobe}
          onChange={(entries) =>
            setEditing((current) => ({ ...current, entries }))
          }
          pinned={[]}
          onPin={null}
          disabled={busy}
          readOnly={false}
          laundryDisabled={busy}
          onLaundry={null}
        />
        <div className="mt-6 flex gap-4">
          <button className={signalButtonClass} disabled={busy} type="submit">
            {busy ? 'Saving …' : 'Save outfit'}
          </button>
          <button
            className={linkButtonClass}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
};
