import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  frameClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import type { TodayView } from '../schemas/today-view.ts';
import { BackfillPrompt } from './backfill-prompt.tsx';
import { OccasionNote } from './occasion-note.tsx';
import { Deciding, ProposalSection } from './proposal-section.tsx';
import { ProblemSection, ReceiptSection } from './receipt-section.tsx';
import { type TodayController, useToday } from './use-today.ts';
import { WeatherStrip } from './weather-strip.tsx';

const failureMessage = (error: unknown): string =>
  error instanceof Error && error.message !== ''
    ? error.message
    : 'That did not go through. Try again.';

const AskForOne = ({ onAsk }: { readonly onAsk: () => void }) => (
  <section className="mt-8 max-w-prose">
    <p className="type-eyebrow">Today</p>
    <p className="type-display mt-2 text-3xl text-ink">
      No proposal for today yet.
    </p>
    <p className="mt-6">
      <button className={signalButtonClass} onClick={onAsk} type="button">
        Ask for one
      </button>
    </p>
  </section>
);

/** Whichever of the day's states applies: dressed, proposed, deciding, stuck, or idle. */
const DayBody = ({ today }: { readonly today: TodayController }) => {
  const { view } = today;
  if (view.worn !== null) {
    return (
      <ReceiptSection
        justLogged={today.justLogged}
        view={view}
        worn={view.worn}
      />
    );
  }
  if (view.problem !== null) {
    return (
      <ProblemSection
        onRetry={today.decide}
        problem={view.problem}
        retrying={today.deciding}
      />
    );
  }
  if (view.proposal !== null) {
    return <ProposalSection proposal={view.proposal} today={today} />;
  }
  if (today.deciding || today.needsDecision) {
    return <Deciding />;
  }
  return <AskForOne onAsk={today.decide} />;
};

export const TodayPage = ({ initial }: { readonly initial: TodayView }) => {
  const today = useToday(initial);
  const { view } = today;
  const [dismissedBackfill, setDismissedBackfill] = useState(false);
  const noteBelow = view.worn !== null || view.problem !== null;
  const wardrobeActionShown =
    view.worn === null &&
    (view.problem?.kind === 'wardrobe-empty' ||
      view.problem?.kind === 'slot-empty');

  return (
    <div className={frameClass}>
      <WeatherStrip
        locationLabel={view.locationLabel}
        stale={view.forecastStale}
        today={view.today}
        weather={view.weather}
      />

      {view.unloggedDays.length > 0 && !dismissedBackfill ? (
        <div className="mt-6">
          <BackfillPrompt
            days={view.unloggedDays}
            onDismiss={() => setDismissedBackfill(true)}
            onSame={today.backfill}
            pending={today.backfilling}
          />
        </div>
      ) : null}

      {today.failure === undefined ? null : (
        <Notice className="mt-6" live={true}>
          {failureMessage(today.failure)}
        </Notice>
      )}

      <DayBody today={today} />

      {noteBelow ? (
        <div className="mt-10 border-rule border-t pt-6">
          <OccasionNote
            occasion={view.occasion}
            onSave={today.saveOccasion}
            pending={today.savingOccasion}
            remakes={view.worn === null}
          />
        </div>
      ) : null}

      {wardrobeActionShown ? null : (
        <p className="mt-8">
          <Link className={quietButtonClass} to="/wardrobe">
            Add clothes
          </Link>
        </p>
      )}
    </div>
  );
};
