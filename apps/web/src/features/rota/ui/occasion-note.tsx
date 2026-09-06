import { useId, useState } from 'react';
import {
  fieldClass,
  labelClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';

type OccasionNoteProps = {
  readonly occasion: string | null;
  readonly pending: boolean;
  /** Whether saving will remake the proposal (true while the day is still open). */
  readonly remakes: boolean;
  readonly onSave: (occasion: string) => void;
};

const occasionLength = 280;

/**
 * The one free-text input on Today. A note is an instruction to the valet:
 * "meeting at two", "hiking", "at home all day". It is written in a dialog, so
 * the outfit stays where it is; while the day is open, saving asks for the
 * outfit again with the note in hand.
 */
export const OccasionNote = ({
  occasion,
  pending,
  remakes,
  onSave,
}: OccasionNoteProps) => {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(occasion ?? '');

  const openEditor = () => {
    setDraft(occasion ?? '');
    setEditing(true);
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <p className="type-eyebrow">Occasion</p>
      <p className="text-ink text-sm">
        {occasion ?? <span className="text-ink-faint">None noted</span>}
      </p>
      {occasion === null ? (
        <button className={linkButtonClass} onClick={openEditor} type="button">
          Add a note
        </button>
      ) : (
        <IconButton
          icon="edit"
          label="Edit occasion note"
          onClick={openEditor}
        />
      )}
      <Dialog
        eyebrow="Occasion"
        onClose={() => setEditing(false)}
        open={editing}
        title={occasion === null ? 'What is today?' : 'Change the note'}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
            setEditing(false);
          }}
        >
          <label className={labelClass} htmlFor={id}>
            A word for the valet
          </label>
          <input
            autoComplete="off"
            className={[fieldClass, 'mt-2'].join(' ')}
            id={id}
            maxLength={occasionLength}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Meeting at two, hiking, at home all day …"
            type="text"
            value={draft}
          />
          <p className="mt-2 text-ink-faint text-xs">
            {remakes
              ? 'Saving asks for the outfit again with this in mind.'
              : 'The day is decided; the note is kept with it.'}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              aria-busy={pending}
              className={quietButtonClass}
              disabled={pending}
              type="submit"
            >
              {pending ? 'Saving …' : 'Save note'}
            </button>
            <button
              className={linkButtonClass}
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
