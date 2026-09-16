import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { formatDayMonth, formatWeekday } from '#/shared/time/local-date.ts';
import {
  inkButtonClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import type { UnloggedGap } from '../schemas/today-view.ts';

type BackfillPromptProps = {
  readonly gap: UnloggedGap;
  readonly pending: boolean;
  readonly onSame: (gap: UnloggedGap) => void;
  readonly onDismiss: () => void;
};

const dayLabel = (date: UnloggedGap['from']) =>
  `${formatWeekday(date)} ${formatDayMonth(date)}`;

/** One blank day: a tap says it was the same as the day before, a link opens the editor for anything else. */
const OneDayActions = ({ gap, pending, onSame }: BackfillPromptProps) => (
  <>
    <button
      aria-busy={pending}
      className={inkButtonClass}
      disabled={pending}
      onClick={() => onSame(gap)}
      type="button"
    >
      {pending
        ? 'Saving …'
        : `Same as ${formatWeekday(gap.lastLogged, 'short')}`}
    </button>
    <Link className={quietButtonClass} to="/history/catch-up">
      Something else
    </Link>
  </>
);

/**
 * Days went by without a word. Asked on the Today page because the rotation
 * reads the day before; the gap has no horizon, so it stays until the days
 * are filled in or today is behind you. Dismissing leaves them blank.
 */
export const BackfillPrompt = (props: BackfillPromptProps) => {
  const headingId = useId();
  const { gap, onDismiss } = props;
  const one = gap.count === 1;
  const names = gap.lastNames.join(', ');
  return (
    <section
      aria-labelledby={headingId}
      className="border border-ink p-4 sm:px-6 sm:py-5"
    >
      <p className="type-eyebrow">
        {one ? 'A day without a log' : `${gap.count} days without a log`}
      </p>
      <h2 className="type-display mt-1 text-2xl text-ink" id={headingId}>
        {one
          ? `${dayLabel(gap.from)}: same as ${formatWeekday(gap.lastLogged, 'short')}?`
          : `${dayLabel(gap.from)} to ${dayLabel(gap.to)}: what did you wear?`}
      </h2>
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        {one
          ? `On ${formatWeekday(gap.lastLogged)} you wore ${names}. Rota reads the day before to keep the rotation straight, so say what ${formatWeekday(gap.from)} was.`
          : `You last logged ${dayLabel(gap.lastLogged)}: ${names}. Rota reads the day before to keep the rotation straight. Fill in what you remember, or leave the days blank.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {one ? (
          <OneDayActions {...props} />
        ) : (
          <Link className={inkButtonClass} to="/history/catch-up">
            Fill in {gap.count} days
          </Link>
        )}
        <button className={linkButtonClass} onClick={onDismiss} type="button">
          Leave it blank
        </button>
      </div>
    </section>
  );
};
