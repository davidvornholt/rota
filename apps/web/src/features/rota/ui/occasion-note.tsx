import { useId, useState } from 'react';

import {
  fieldClass,
  labelClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';

type OccasionNoteProps = {
  readonly occasion: string | null;
  readonly pending: boolean;
  /** Whether saving will remake the proposal (true while the day is still open). */
  readonly remakes: boolean;
  readonly onSave: (occasion: string) => void;
};

/**
 * The one free-text input on Today. A note is an instruction to the valet:
 * "meeting at two", "hiking", "at home all day". While the day is open, saving
 * asks for the outfit again with the note in hand.
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

  const submit = () => {
    onSave(draft);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="type-eyebrow">Occasion</p>
        <p className="text-ink text-sm">
          {occasion ?? <span className="text-ink-faint">None noted</span>}
        </p>
        <button
          className={linkButtonClass}
          onClick={() => {
            setDraft(occasion ?? '');
            setEditing(true);
          }}
          type="button"
        >
          {occasion === null ? 'Add a note' : 'Change'}
        </button>
      </div>
    );
  }

  return (
    <form
      className="max-w-prose"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className={labelClass} htmlFor={id}>
        Occasion
      </label>
      <input
        autoComplete="off"
        className={[fieldClass, 'mt-2'].join(' ')}
        id={id}
        maxLength={280}
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
      <div className="mt-3 flex gap-3">
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
  );
};
