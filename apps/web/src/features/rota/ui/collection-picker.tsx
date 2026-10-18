import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  fieldClass,
  labelClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import {
  collectionNameLength,
  collectionsPerOutfit,
  resolveCollections,
  tidyCollection,
} from '../outfit-collections.ts';
import { CollectionChip } from './collection-chip.tsx';

/**
 * Adding empties the name, which disables the focused Add button, and adding
 * the last collection there is room for disables the field as well. The
 * addition renders at once, so focus can move to the field, or else to the
 * new chip, which is pressed and stays enabled.
 */
const useFocusAfterAdd = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef(new Map<string, HTMLButtonElement | null>());
  const addThenFocus = (chip: string, addition: () => void) => {
    flushSync(addition);
    const input = inputRef.current;
    if (input !== null && !input.disabled) {
      input.focus();
    } else {
      chipsRef.current.get(chip)?.focus();
    }
  };
  const chipRef = (name: string) => (node: HTMLButtonElement | null) => {
    chipsRef.current.set(name, node);
  };
  return { inputRef, chipRef, addThenFocus };
};

/**
 * Puts an outfit in existing collections or a new one. The new name stays in
 * the parent's hands, so saving the outfit can include a name typed but not
 * yet added.
 */
export const CollectionPicker = ({
  chosen,
  existing,
  draft,
  disabled,
  onChange,
  onDraft,
}: {
  readonly chosen: ReadonlyArray<string>;
  readonly existing: ReadonlyArray<string>;
  readonly draft: string;
  readonly disabled: boolean;
  readonly onChange: (collections: ReadonlyArray<string>) => void;
  readonly onDraft: (draft: string) => void;
}) => {
  const inputId = useId();
  const hintId = useId();
  // A new collection stays offered after it is switched off again.
  const [added, setAdded] = useState<ReadonlyArray<string>>([]);
  const options = resolveCollections(
    [...existing, ...chosen, ...added],
    [...existing, ...chosen],
  );
  const full = chosen.length >= collectionsPerOutfit;
  const focus = useFocusAfterAdd();
  const choose = (name: string) =>
    onChange(resolveCollections([...chosen, name], options));
  const add = () => {
    const name = tidyCollection(draft);
    if (name === '' || full) {
      return;
    }
    // The chip spells the name the way an existing collection does.
    const [chip = name] = resolveCollections([name], options);
    focus.addThenFocus(chip, () => {
      setAdded((current) => [...current, name]);
      choose(name);
      onDraft('');
    });
  };
  return (
    <fieldset aria-describedby={hintId} className="mb-6">
      <legend className={labelClass}>Collections</legend>
      <p className="mt-1 text-ink-muted text-sm" id={hintId}>
        {full
          ? `An outfit can be in up to ${collectionsPerOutfit} collections.`
          : 'Group outfits, for example by occasion or season. An outfit can be in several.'}
      </p>
      {options.length === 0 ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((name) => {
            const pressed = chosen.includes(name);
            return (
              <CollectionChip
                key={name}
                name={name}
                pressed={pressed}
                disabled={disabled || (full && !pressed)}
                onToggle={() =>
                  pressed
                    ? onChange(chosen.filter((item) => item !== name))
                    : choose(name)
                }
                ref={focus.chipRef(name)}
              />
            );
          })}
        </div>
      )}
      <label className="mt-4 block text-sm" htmlFor={inputId}>
        New collection
      </label>
      <div className="mt-2 flex gap-2">
        <input
          className={fieldClass}
          disabled={disabled || full}
          id={inputId}
          maxLength={collectionNameLength}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the collection here instead of saving the outfit.
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
          ref={focus.inputRef}
          value={draft}
        />
        <button
          className={`${quietButtonClass} shrink-0`}
          disabled={disabled || full || tidyCollection(draft) === ''}
          onClick={add}
          type="button"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
};
