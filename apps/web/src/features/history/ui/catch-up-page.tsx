import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { slotOrder } from '#/shared/data/garment-types.ts';
import {
  formatLongDate,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import {
  frameClass,
  inkButtonClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import type { CatchUpDay, CatchUpView } from '../services/history-fns.ts';
import {
  blankChoices,
  type Choices,
  type DayToSave,
  dayBefore,
  daysToSave,
  replaceAt,
} from './catch-up-choices.ts';
import { type Choice, isBlank } from './day-choice.ts';
import { SlotPicker } from './slot-picker.tsx';
import { weatherLine } from './weather-line.ts';

type CatchUpPageProps = {
  readonly view: CatchUpView;
  /** Writes the picked days in one go; the route wires the wear-log service in. */
  readonly save: (days: ReadonlyArray<DayToSave>) => Promise<unknown>;
};

const Header = ({ title }: { readonly title: string }) => (
  <>
    <p className="type-eyebrow">
      <Link className="hover:text-ink" to="/history">
        History
      </Link>
      <span> / </span>
      Catch up
    </p>
    <h1 className="type-display mt-2 text-4xl text-ink sm:text-5xl">{title}</h1>
  </>
);

/** No blank days: either everything up to yesterday is logged, or nothing is yet. */
const NothingToCatchUp = ({ view }: { readonly view: CatchUpView }) => (
  <div className={frameClass}>
    <Header title="Nothing to catch up on" />
    <p className="mt-6 max-w-prose text-ink-muted">
      {view.lastLogged === null
        ? 'Nothing is logged yet. Rota starts counting from the first day you log.'
        : 'Every day up to yesterday is logged.'}
    </p>
    <p className="mt-8">
      <Link className={quietButtonClass} to="/">
        Back to today
      </Link>
    </p>
  </div>
);

type DayFieldsetProps = {
  readonly day: CatchUpDay;
  readonly choice: Choice;
  /** The day this one can copy, and what it currently holds. */
  readonly before: { readonly date: LocalDate; readonly choice: Choice };
  readonly choices: CatchUpView['choices'];
  readonly onChange: (choice: Choice) => void;
};

/** One blank day: what the weather and the note were, a copy from the day before, and the four slots. */
const DayFieldset = ({
  day,
  choice,
  before,
  choices,
  onChange,
}: DayFieldsetProps) => (
  <fieldset className="mt-10 min-w-0">
    <legend className="type-display text-2xl text-ink sm:text-3xl">
      {formatLongDate(day.date)}
    </legend>
    <p className="type-data mt-1 text-ink-muted text-sm">
      {weatherLine(day.weather)}
    </p>
    {day.occasion === null ? null : (
      <p className="mt-1 max-w-prose text-ink-muted text-sm">
        Occasion: {day.occasion}
      </p>
    )}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        className={quietButtonClass}
        disabled={isBlank(before.choice)}
        onClick={() => onChange(before.choice)}
        type="button"
      >
        Same as {formatWeekday(before.date)}
      </button>
      {isBlank(choice) ? null : (
        <button
          className={linkButtonClass}
          onClick={() => onChange({})}
          type="button"
        >
          Clear
        </button>
      )}
    </div>
    <ul className="mt-3 border-rule border-b sm:grid sm:grid-cols-2 sm:gap-x-8">
      {slotOrder.map((slot) => (
        <SlotPicker
          candidates={choices[slot]}
          chosen={choices[slot].find((garment) => garment.id === choice[slot])}
          key={slot}
          onChange={(garmentId) => onChange({ ...choice, [slot]: garmentId })}
          slot={slot}
        />
      ))}
    </ul>
  </fieldset>
);

const saveLabel = (pending: boolean, count: number) => {
  if (pending) {
    return 'Saving …';
  }
  if (count === 0) {
    return 'Save';
  }
  return count === 1 ? 'Save 1 day' : `Save ${count} days`;
};

/**
 * The blank days since the last log, oldest first, each open for what was
 * worn. Days start empty: nothing is assumed about a day you did not log. One
 * save writes every day with a garment picked and leaves the rest blank.
 */
export const CatchUpPage = ({ view, save }: CatchUpPageProps) => {
  const router = useRouter();
  const [picks, setPicks] = useState<Choices>(() =>
    blankChoices(view.days.length),
  );
  useEffect(() => {
    setPicks(blankChoices(view.days.length));
  }, [view]);

  const dates = view.days.map((day) => day.date);
  const toSave = daysToSave(dates, picks);
  const write = useMutation({
    mutationFn: () => save(toSave),
    onSuccess: async () => {
      await router.invalidate();
      await router.navigate({ to: '/' });
    },
  });

  const { lastLogged } = view;
  if (lastLogged === null || view.days.length === 0) {
    return <NothingToCatchUp view={view} />;
  }
  const count = view.days.length;
  return (
    <div className={frameClass}>
      <Header
        title={
          count === 1 ? 'A day without a log' : `${count} days without a log`
        }
      />
      <p className="mt-6 max-w-prose text-ink-muted">
        You last logged {formatLongDate(lastLogged.date)}:{' '}
        {lastLogged.names.join(', ')}. Fill in what you remember; a day you
        leave blank stays blank.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          write.mutate();
        }}
      >
        {view.days.map((day, index) => {
          const beforeDate = index === 0 ? lastLogged.date : dates[index - 1];
          return (
            <DayFieldset
              before={{
                date: beforeDate ?? lastLogged.date,
                choice: dayBefore(picks, index, lastLogged.outfit) ?? {},
              }}
              choice={picks[index] ?? {}}
              choices={view.choices}
              day={day}
              key={day.date}
              onChange={(choice) =>
                setPicks((current) => replaceAt(current, index, choice))
              }
            />
          );
        })}
        {write.isError ? (
          <Notice className="mt-6" live={true}>
            {write.error instanceof Error && write.error.message !== ''
              ? write.error.message
              : 'The days could not be saved. Try again.'}
          </Notice>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            aria-busy={write.isPending}
            className={inkButtonClass}
            disabled={write.isPending || toSave.length === 0}
            type="submit"
          >
            {saveLabel(write.isPending, toSave.length)}
          </button>
          <Link className={linkButtonClass} to="/">
            Back to today
          </Link>
        </div>
      </form>
    </div>
  );
};
