import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { slotOrder } from '#/shared/data/garment-types.ts';
import {
  addDays,
  formatDayMonth,
  formatLongDate,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import {
  frameClass,
  inkButtonClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import type { DayView } from '../services/history-fns.ts';
import {
  type Choice,
  type DayEntries,
  entriesOf,
  sameChoice,
} from './day-choice.ts';
import { SlotPicker } from './slot-picker.tsx';
import { weatherLine } from './weather-line.ts';

type DayPageProps = {
  readonly view: DayView;
  /** Writes the day; the route wires the wear-log service in. */
  readonly save: (date: LocalDate, entries: DayEntries) => Promise<unknown>;
};

const choiceOf = (view: DayView): Choice =>
  Object.fromEntries(view.worn.map((item) => [item.slot, item.garment.id]));

const DayHeader = ({ view }: { readonly view: DayView }) => (
  <>
    <p className="type-eyebrow">
      <Link className="hover:text-ink" to="/history">
        History
      </Link>
      <span> / </span>
      {view.date === view.today ? 'Today' : formatDayMonth(view.date)}
    </p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-rule border-b pb-4">
      <h1 className="type-display text-4xl text-ink sm:text-5xl">
        {formatLongDate(view.date)}
      </h1>
      <p className="type-data text-ink-muted text-sm">
        {weatherLine(view.weather)}
      </p>
    </div>
    <nav
      aria-label="Neighbouring days"
      className="mt-3 flex justify-between text-sm"
    >
      <Link
        className={linkButtonClass}
        params={{ date: addDays(view.date, -1) }}
        to="/history/$date"
      >
        ← {formatDayMonth(addDays(view.date, -1))}
      </Link>
      {view.date < view.today ? (
        <Link
          className={linkButtonClass}
          params={{ date: addDays(view.date, 1) }}
          to="/history/$date"
        >
          {formatDayMonth(addDays(view.date, 1))} →
        </Link>
      ) : null}
    </nav>
    {view.headline === null ? null : (
      <p className="mt-6 max-w-prose text-ink-muted italic">
        “{view.headline}”
      </p>
    )}
    {view.occasion === null ? null : (
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        Occasion: {view.occasion}
      </p>
    )}
  </>
);

const saveLabel = (pending: boolean, entries: DayEntries) => {
  if (pending) {
    return 'Saving …';
  }
  return entries.length === 0 ? 'Clear the day' : 'Save the day';
};

/**
 * One day of the log, open for correction. Each slot is a select over the
 * garments that fit it; the picture beside it is what is chosen. Saving writes
 * the whole day, so the rotation reads the corrected truth.
 */
export const DayPage = ({ view, save }: DayPageProps) => {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(() => choiceOf(view));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setChoice(choiceOf(view));
    setSaved(false);
  }, [view]);

  const entries = entriesOf(choice);
  const changed = !sameChoice(choice, choiceOf(view));
  const write = useMutation({
    mutationFn: () => save(view.date, entries),
    onSuccess: () => {
      setSaved(true);
      router.invalidate().catch(() => undefined);
    },
  });

  return (
    <div className={frameClass}>
      <DayHeader view={view} />
      {view.date > view.today ? (
        <Notice className="mt-8">This day has not happened yet.</Notice>
      ) : (
        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            write.mutate();
          }}
        >
          <ul className="border-rule border-b">
            {slotOrder.map((slot) => (
              <SlotPicker
                candidates={view.choices[slot]}
                day={view.date}
                chosen={view.choices[slot].find(
                  (garment) => garment.id === choice[slot],
                )}
                key={slot}
                onChange={(garmentId) => {
                  setSaved(false);
                  setChoice((current) => ({ ...current, [slot]: garmentId }));
                }}
                slot={slot}
              />
            ))}
          </ul>
          {write.isError ? (
            <Notice className="mt-4" live={true}>
              {write.error instanceof Error && write.error.message !== ''
                ? write.error.message
                : 'The day could not be saved. Try again.'}
            </Notice>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              aria-busy={write.isPending}
              className={inkButtonClass}
              disabled={write.isPending || !changed}
              type="submit"
            >
              {saveLabel(write.isPending, entries)}
            </button>
            {saved ? (
              <span className="text-ink-muted text-sm" role="status">
                Saved
              </span>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
};
