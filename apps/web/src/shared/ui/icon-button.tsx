import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const paths = {
  close: 'm6 6 12 12M6 18 18 6',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
} as const;

export type ActionIcon = keyof typeof paths;

type IconButtonProps = {
  readonly icon: ActionIcon;
  readonly label: string;
  readonly tooltip?: string;
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly onClick: () => void;
};

const viewportInset = 8;

/** Small artwork, a full touch target, and a tooltip reachable by mouse or keyboard. */
export const IconButton = ({
  icon,
  label,
  tooltip = label,
  disabled = false,
  pending = false,
  onClick,
}: IconButtonProps) => {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [alignment, setAlignment] = useState('left-0');
  const open = (hovered || focused) && !dismissed;
  const unavailable = disabled || pending;

  useLayoutEffect(() => {
    if (!open || anchor.current === null || bubble.current === null) {
      return;
    }
    const rect = anchor.current.getBoundingClientRect();
    const { width } = bubble.current.getBoundingClientRect();
    if (rect.left + width <= window.innerWidth - viewportInset) {
      setAlignment('left-0');
    } else if (rect.right - width >= viewportInset) {
      setAlignment('right-0');
    } else {
      setAlignment('left-1/2 -translate-x-1/2');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Dismiss the tooltip before Escape can also close its containing dialog.
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
      }
    };
    document.addEventListener('keydown', dismiss, true);
    return () => document.removeEventListener('keydown', dismiss, true);
  }, [open]);

  return (
    <span
      className="relative inline-flex shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          setHovered(true);
          setDismissed(false);
        }
      }}
      onPointerLeave={() => setHovered(false)}
      ref={anchor}
    >
      <button
        aria-busy={pending}
        aria-describedby={open ? id : undefined}
        aria-disabled={unavailable}
        aria-label={label}
        className="inline-flex size-11 shrink-0 items-center justify-center text-ink-muted hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onBlur={() => setFocused(false)}
        onClick={() => {
          if (!unavailable) {
            setDismissed(true);
            onClick();
          }
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path d={paths[icon]} />
        </svg>
      </button>
      {open ? (
        <span
          className={[
            'absolute top-full z-20 w-max max-w-56 pt-1',
            alignment,
          ].join(' ')}
          id={id}
          ref={bubble}
          role="tooltip"
        >
          <span className="block border border-rule-strong bg-paper px-2 py-1 text-ink text-xs">
            {tooltip}
          </span>
        </span>
      ) : null}
    </span>
  );
};
