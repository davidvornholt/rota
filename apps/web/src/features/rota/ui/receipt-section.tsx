import { Link } from '@tanstack/react-router';
import { useId } from 'react';

import { linkButtonClass, signalButtonClass } from '#/shared/ui/classes.ts';
import type {
  TodayProblem,
  TodayView,
  WornItemView,
} from '../schemas/today-view.ts';
import { OutfitRow } from './outfit-row.tsx';

type ReceiptProps = {
  readonly view: TodayView;
  readonly worn: ReadonlyArray<WornItemView>;
  readonly justLogged: boolean;
};

/** The day once it is dressed: what was worn, each with its tally, and what tomorrow knows. */
export const ReceiptSection = ({ view, worn, justLogged }: ReceiptProps) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <p className="type-eyebrow">Logged</p>
      <h2
        className="type-display mt-2 text-3xl text-ink sm:text-4xl"
        id={headingId}
      >
        Today is dressed.
      </h2>
      <div
        aria-hidden="true"
        className={[
          'mt-4 h-1 w-40 origin-left bg-signal',
          justLogged ? 'animate-fill-across motion-reduce:animate-none' : '',
        ].join(' ')}
      />
      <ul className="mt-6 border-rule border-b">
        {worn.map((item) => (
          <OutfitRow
            animateTally={justLogged}
            budget={item.budget}
            continued={item.dayOfBudget > 1}
            dayOfBudget={item.dayOfBudget}
            emphasis="receipt"
            garment={item.garment}
            key={item.slot}
            reason=""
            slot={item.slot}
          />
        ))}
      </ul>
      {view.tomorrowHint === null ? null : (
        <p className="mt-6 max-w-prose text-ink-muted">{view.tomorrowHint}</p>
      )}
      <p className="mt-6">
        <Link
          className={linkButtonClass}
          params={{ date: view.today }}
          to="/history/$date"
        >
          Change what you wore
        </Link>
      </p>
    </section>
  );
};

type ProblemProps = {
  readonly problem: TodayProblem;
  readonly onRetry: () => void;
  readonly retrying: boolean;
};

const ProblemAction = ({ problem, onRetry, retrying }: ProblemProps) => {
  switch (problem.kind) {
    case 'location-missing':
      return (
        <Link className={signalButtonClass} to="/settings">
          Choose a place
        </Link>
      );
    case 'wardrobe-empty':
    case 'slot-empty':
      return (
        <Link className={signalButtonClass} to="/wardrobe">
          Open the wardrobe
        </Link>
      );
    default:
      return (
        <button
          aria-busy={retrying}
          className={signalButtonClass}
          disabled={retrying}
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      );
  }
};

/** Why there is no proposal, and the one thing that would change that. */
export const ProblemSection = (props: ProblemProps) => (
  <section className="mt-8 max-w-prose">
    <p className="type-eyebrow">Nothing to propose yet</p>
    <p className="type-display mt-2 text-3xl text-ink">
      {props.problem.message}
    </p>
    <p className="mt-6 flex flex-wrap gap-3">
      <ProblemAction {...props} />
    </p>
  </section>
);
