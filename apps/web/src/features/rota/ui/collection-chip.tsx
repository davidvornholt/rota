import { Check } from 'lucide-react';

/**
 * A collection that can be switched on or off, to filter by it or to put an
 * outfit in it. The tick, not only the fill, shows that it is on.
 */
export const CollectionChip = ({
  name,
  count,
  pressed,
  disabled,
  onToggle,
}: {
  readonly name: string;
  readonly count?: number;
  readonly pressed: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
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
    type="button"
  >
    {pressed ? <Check aria-hidden="true" className="size-4" /> : null}
    {name}
    {count === undefined ? null : (
      <span
        className={[
          'type-data text-xs',
          pressed ? 'text-paper' : 'text-ink-muted',
        ].join(' ')}
      >
        {count}
      </span>
    )}
  </button>
);
