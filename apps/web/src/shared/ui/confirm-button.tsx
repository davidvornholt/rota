import { useEffect, useState } from 'react';
import { linkButtonClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from './icon-button.tsx';

type ConfirmButtonProps = {
  readonly label: string;
  /** The wording of the second press, which is the one that acts. */
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly tone?: 'quiet' | 'link';
};

const armedForMs = 6000;

/**
 * An action that costs something asks twice, in place: the first press arms
 * it and says what will happen, the second does it. Nothing pops up, and an
 * armed button disarms itself if left alone.
 */
export const ConfirmButton = ({
  label,
  confirmLabel,
  onConfirm,
  pending = false,
  disabled = false,
  title,
  tone = 'quiet',
}: ConfirmButtonProps) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) {
      return;
    }
    const timer = setTimeout(() => setArmed(false), armedForMs);
    return () => clearTimeout(timer);
  }, [armed]);

  const className = tone === 'quiet' ? quietButtonClass : linkButtonClass;
  if (!armed) {
    return (
      <IconButton
        icon="trash"
        label={label}
        tooltip={title ?? label}
        pending={pending}
        disabled={disabled}
        onClick={() => setArmed(true)}
      />
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        aria-busy={pending}
        className={[className, 'border-ink'].join(' ')}
        disabled={pending}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        type="button"
      >
        {confirmLabel}
      </button>
      <button
        className={linkButtonClass}
        onClick={() => setArmed(false)}
        type="button"
      >
        Keep it
      </button>
    </span>
  );
};
