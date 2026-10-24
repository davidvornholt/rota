import { Check, Heart } from 'lucide-react';
import type { Ref } from 'react';

/**
 * A collection that can be switched on or off, to filter by it or to put an
 * outfit in it. The tick, not only the fill, shows that it is on.
 */
export const CollectionChip = ({
  name,
  count,
  pressed,
  disabled,
  heart = false,
  onToggle,
  ref,
}: {
  readonly name: string;
  readonly count?: number;
  readonly pressed: boolean;
  readonly disabled: boolean;
  /** Marks the favourites filter: a heart, filled when on, replaces the tick. */
  readonly heart?: boolean;
  readonly onToggle: () => void;
  /** Lets the picker focus a chip it has just added. */
  readonly ref?: Ref<HTMLButtonElement>;
}) => (
  <button
    aria-label={
      count === undefined
        ? undefined
        : `${name}, ${count} outfit${count === 1 ? '' : 's'}`
    }
    aria-pressed={pressed}
    className={[
      'inline-flex min-h-11 items-center gap-2 border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors',
      pressed
        ? 'border-ink bg-ink text-paper'
        : 'border-rule-strong text-ink hover:border-ink',
    ].join(' ')}
    disabled={disabled}
    onClick={onToggle}
    ref={ref}
    type="button"
  >
    {heart ? (
      <Heart
        aria-hidden="true"
        className="size-4"
        fill={pressed ? 'currentColor' : 'none'}
      />
    ) : null}
    {!heart && pressed ? <Check aria-hidden="true" className="size-4" /> : null}
    {name}
    {count === undefined ? null : (
      <>
        {' '}
        <span
          className={[
            'type-data text-xs',
            pressed ? 'text-paper' : 'text-ink-muted',
          ].join(' ')}
        >
          {count}
        </span>
      </>
    )}
  </button>
);
