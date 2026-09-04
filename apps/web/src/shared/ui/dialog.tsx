import { type ReactNode, useEffect, useId, useRef } from 'react';

import { linkButtonClass } from './classes.ts';

type DialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  /** A line under the title in the eyebrow register; names what the dialog is about. */
  readonly eyebrow?: string;
  readonly children: ReactNode;
  readonly size?: 'prose' | 'wide';
};

const widthClass = {
  prose: 'sm:max-w-lg',
  wide: 'sm:max-w-3xl',
} as const;

/**
 * The one modal shape: the native `<dialog>`, opened with `showModal` so focus,
 * Escape, and the inert page come from the browser. It rises from the foot of a
 * phone screen as a sheet and sits centred on a wide one; square-cornered,
 * ruled, and on the paper ground like everything else.
 */
export const Dialog = ({
  open,
  onClose,
  title,
  eyebrow,
  children,
  size = 'prose',
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={[
        'm-0 mt-auto w-full max-w-none border border-ink bg-paper p-0 text-ink',
        'sm:m-auto sm:w-[calc(100%-2rem)]',
        widthClass[size],
        'backdrop:bg-ink/40',
      ].join(' ')}
      onClose={onClose}
      ref={ref}
    >
      <div className="max-h-[85svh] overflow-y-auto px-5 pt-5 pb-6 sm:px-8 sm:pt-6 sm:pb-8">
        <div className="flex items-start justify-between gap-6 border-rule border-b pb-4">
          <div>
            {eyebrow === undefined ? null : (
              <p className="type-eyebrow">{eyebrow}</p>
            )}
            <h2
              className="type-display mt-1 text-2xl text-ink sm:text-3xl"
              id={titleId}
            >
              {title}
            </h2>
          </div>
          <button className={linkButtonClass} onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
};
