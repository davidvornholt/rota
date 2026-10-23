import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ActionGlyph, type ActionIcon, IconButton } from './icon-button.tsx';

export type MenuAction = {
  readonly label: string;
  readonly icon: ActionIcon;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
};

type Opening = 'first' | 'last';

/** Up and Down step through the actions and wrap; Home and End jump. */
const stepFor = (key: string, at: number, count: number) => {
  switch (key) {
    case 'ArrowDown':
      return (at + 1) % count;
    case 'ArrowUp':
      return (at - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return;
  }
};

/** Closes the menu on a press anywhere outside it or its button. */
const useOutsidePress = (
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  close: () => void,
) => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const press = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener('pointerdown', press, true);
    return () => document.removeEventListener('pointerdown', press, true);
  }, [open, rootRef, close]);
};

const menuGap = 4;

/**
 * Opens the menu upward when the screen ends below the button and there is
 * room above it, so no action starts out of sight.
 */
const useOpensUpward = (
  open: boolean,
  buttonRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
) => {
  const [upward, setUpward] = useState(false);
  useLayoutEffect(() => {
    const button = buttonRef.current?.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight;
    if (!open || button === undefined || height === undefined) {
      return;
    }
    const space = height + menuGap;
    setUpward(
      button.bottom + space > window.innerHeight && button.top - space >= 0,
    );
  }, [open, buttonRef, menuRef]);
  return upward;
};

/**
 * Actions too rare to keep on screen, behind one button. The menu takes focus
 * as it opens; arrows, Home and End move through it, and Escape, Tab or a press
 * outside close it. A pick hands focus back to the button before it acts, so a
 * dialog it opens returns there too.
 */
export const MenuButton = ({
  label,
  tooltip,
  actions,
  ref,
}: {
  readonly label: string;
  readonly tooltip?: string;
  readonly actions: ReadonlyArray<MenuAction>;
  /** The button, for focus to return to once a picked action is done. */
  readonly ref?: RefObject<HTMLElement | null>;
}) => {
  const id = useId();
  const [opening, setOpening] = useState<Opening | null>(null);
  const open = opening !== null;
  const close = useCallback(() => setOpening(null), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const ownButtonRef = useRef<HTMLElement>(null);
  const buttonRef = ref ?? ownButtonRef;
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const upward = useOpensUpward(open, buttonRef, menuRef);

  useEffect(() => {
    if (opening !== null) {
      // The menu may not have turned upward yet; it must not scroll the page.
      itemsRef.current[opening === 'first' ? 0 : actions.length - 1]?.focus({
        preventScroll: true,
      });
    }
  }, [opening, actions.length]);
  useOutsidePress(open, rootRef, close);

  const openFromKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpening(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      buttonRef.current?.focus();
      return;
    }
    const at = itemsRef.current.indexOf(
      event.target instanceof HTMLButtonElement ? event.target : null,
    );
    const next = stepFor(event.key, at, actions.length);
    if (next !== undefined) {
      event.preventDefault();
      itemsRef.current[next]?.focus();
    }
  };
  const pick = (action: MenuAction) => {
    if (action.disabled === true) {
      return;
    }
    buttonRef.current?.focus();
    close();
    action.onSelect();
  };

  return (
    <div className="relative" ref={rootRef}>
      <IconButton
        icon="more"
        label={label}
        menu={{ id, expanded: open, onKeyDown: openFromKey }}
        onClick={() => setOpening(open ? null : 'first')}
        ref={buttonRef}
        tooltip={tooltip}
      />
      {open ? (
        <div
          aria-label={label}
          className={[
            'absolute right-0 z-20 w-max min-w-48 border border-ink bg-paper py-1 motion-safe:animate-soft-reveal',
            upward ? 'bottom-full mb-1' : 'top-full mt-1',
          ].join(' ')}
          id={id}
          onBlur={(event) => {
            // Tab moves focus on past the menu; that closes it.
            if (
              event.relatedTarget instanceof Node &&
              !rootRef.current?.contains(event.relatedTarget)
            ) {
              close();
            }
          }}
          onKeyDown={moveFocus}
          ref={menuRef}
          role="menu"
        >
          {actions.map((action, index) => (
            <button
              aria-disabled={action.disabled === true}
              className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-ink text-sm hover:bg-paper-deep focus:bg-paper-deep focus-visible:outline-offset-[-2px] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              key={action.label}
              onClick={() => pick(action)}
              ref={(item) => {
                itemsRef.current[index] = item;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              <ActionGlyph icon={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
