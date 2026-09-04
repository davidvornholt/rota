import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { formatDayMonth, formatWeekday } from '#/shared/time/local-date.ts';
import {
  inkButtonClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import type { UnloggedDay } from '../schemas/today-view.ts';

type BackfillPromptProps = {
  readonly days: ReadonlyArray<UnloggedDay>;
  readonly pending: boolean;
  readonly onSame: (day: UnloggedDay) => void;
  readonly onDismiss: () => void;
};

/**
 * A day went by without a word. Asked before today's proposal, because the
 * rotation reads yesterday: one tap says it was the same as the day before,
 * a link opens the editor for anything else, and dismissing leaves the day
 * blank in the log.
 */
export const BackfillPrompt = ({
  days,
  pending,
  onSame,
  onDismiss,
}: BackfillPromptProps) => {
  const headingId = useId();
  const [first] = days;
  if (first === undefined) {
    return null;
  }
  const names = first.previousNames.join(', ');
  return (
    <section
      aria-labelledby={headingId}
      className="border border-ink p-4 sm:px-6 sm:py-5"
    >
      <p className="type-eyebrow">
        {days.length === 1
          ? 'A day without a log'
          : `${days.length} days without a log`}
      </p>
      <h2 className="type-display mt-1 text-2xl text-ink" id={headingId}>
        {formatWeekday(first.date)} {formatDayMonth(first.date)}: same as{' '}
        {formatWeekday(first.previousDate, 'short')}?
      </h2>
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        On {formatWeekday(first.previousDate)} you wore {names}. Rota reads the
        day before to keep the rotation straight, so say what{' '}
        {formatWeekday(first.date)} was.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          aria-busy={pending}
          className={inkButtonClass}
          disabled={pending}
          onClick={() => onSame(first)}
          type="button"
        >
          {pending
            ? 'Saving …'
            : `Same as ${formatWeekday(first.previousDate, 'short')}`}
        </button>
        <Link
          className={quietButtonClass}
          params={{ date: first.date }}
          to="/history/$date"
        >
          Something else
        </Link>
        <button className={linkButtonClass} onClick={onDismiss} type="button">
          Leave it blank
        </button>
      </div>
    </section>
  );
};
