import { Link, type LinkProps } from '@tanstack/react-router';
import {
  ArrowLeft,
  BookMarked,
  Bookmark,
  Check,
  Clock,
  Copy,
  Eye,
  KeyRound,
  LogOut,
  Minus,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  Users,
  WashingMachine,
  X,
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const icons = {
  close: X,
  edit: Pencil,
  trash: Trash2,
  bookmark: Bookmark,
  bookmarks: BookMarked,
  laundry: WashingMachine,
  refresh: RotateCw,
  logout: LogOut,
  copy: Copy,
  clock: Clock,
  check: Check,
  plus: Plus,
  minus: Minus,
  key: KeyRound,
  users: Users,
  eye: Eye,
  arrowLeft: ArrowLeft,
};
export type ActionIcon = keyof typeof icons;

type IconButtonProps = {
  readonly icon: ActionIcon;
  readonly label: string;
  readonly tooltip?: string;
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly onClick?: () => void;
  readonly linkOptions?: LinkProps;
};

const viewportInset = 8;
const tooltipLeaveDelay = 100;

const useTooltipDismiss = (
  open: boolean,
  setDismissed: (dismissed: boolean) => void,
) => {
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
    return () => {
      document.removeEventListener('keydown', dismiss, true);
    };
  }, [open, setDismissed]);
};

/** Small artwork, a full touch target, and a tooltip reachable by mouse or keyboard. */
export const IconButton = ({
  icon,
  label,
  tooltip = label,
  disabled = false,
  pending = false,
  onClick,
  linkOptions,
}: IconButtonProps) => {
  const Icon = icons[icon];
  const Control = linkOptions ? Link : 'button';
  const id = useId();
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const holdTooltip = () => {
    clearTimeout(leaveTimerRef.current);
    setHovered(true);
    setDismissed(false);
  };
  const leaveTooltip = () => {
    leaveTimerRef.current = setTimeout(
      () => setHovered(false),
      tooltipLeaveDelay,
    );
  };
  useEffect(() => () => clearTimeout(leaveTimerRef.current), []);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const open = (hovered || focused) && !dismissed;
  const unavailable = disabled || pending;

  useLayoutEffect(() => {
    const place = () => {
      if (!open || anchorRef.current === null || bubbleRef.current === null) {
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();
      const { width, height } = bubbleRef.current.getBoundingClientRect();
      setPosition({
        left: Math.max(
          viewportInset,
          Math.min(rect.left, window.innerWidth - width - viewportInset),
        ),
        top:
          rect.bottom + height <= window.innerHeight - viewportInset
            ? rect.bottom
            : Math.max(viewportInset, rect.top - height),
      });
    };
    place();
    if (!open) {
      return;
    }
    document.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useTooltipDismiss(open, setDismissed);

  return (
    <span
      className="relative inline-flex shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          holdTooltip();
        }
      }}
      onPointerLeave={leaveTooltip}
      ref={anchorRef}
    >
      <Control
        {...linkOptions}
        aria-busy={pending}
        aria-describedby={open ? id : undefined}
        aria-disabled={unavailable}
        aria-label={label}
        className="inline-flex size-11 shrink-0 items-center justify-center text-ink-muted hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:active:scale-95"
        onBlur={() => setFocused(false)}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault();
          }
          if (!unavailable) {
            setDismissed(true);
            onClick?.();
          }
        }}
        onFocus={(event) => {
          // Focus a dialog hands out on opening, or a click leaves behind, is
          // not a request for the tooltip; only visible (keyboard) focus is.
          if (event.currentTarget.matches(':focus-visible')) {
            setFocused(true);
            setDismissed(false);
          }
        }}
        type={linkOptions ? undefined : 'button'}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
      </Control>
      {open && anchorRef.current
        ? createPortal(
            <span
              className="fixed z-50 w-max max-w-56 py-1 motion-safe:animate-soft-reveal"
              // biome-ignore lint/nursery/noInlineStyles: Tooltip placement uses measured viewport coordinates to avoid clipping and extra modal scrollbars.
              style={position}
              id={id}
              ref={bubbleRef}
              role="tooltip"
              onPointerEnter={holdTooltip}
              onPointerLeave={leaveTooltip}
            >
              <span className="block border border-rule-strong bg-paper px-2 py-1 text-ink text-xs">
                {tooltip}
              </span>
            </span>,
            anchorRef.current.closest('dialog') ?? document.body,
          )
        : null}
    </span>
  );
};
