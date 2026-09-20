import { Link } from '@tanstack/react-router';
import { addDays, formatDayMonth } from '#/shared/time/local-date.ts';
import {
  linkButtonClass,
  tabActiveClass,
  tabClass,
} from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { DayPreferences } from './day-preferences.tsx';
import type { PlanningController } from './use-planning.ts';
export const PlanningNavigation = ({
  controller,
  onPanel,
}: {
  readonly controller: PlanningController;
  readonly onPanel: (panel: 'outfits' | 'laundry') => void;
}) => {
  const { view, busy } = controller;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-rule border-b">
      <nav aria-label="Outfit day" className="flex gap-6">
        {[
          { label: 'Today', date: view.actualToday },
          { label: 'Tomorrow', date: addDays(view.actualToday, 1) },
        ].map(({ label, date }) => (
          <Link
            aria-current={view.day.today === date ? 'page' : undefined}
            className={[
              tabClass,
              view.day.today === date ? tabActiveClass : '',
            ].join(' ')}
            aria-label={label}
            disabled={busy || controller.planSave.saving}
            key={label}
            to="/"
            search={{ date }}
          >
            {label}
            <span aria-hidden="true" className="ml-2 text-ink-muted text-xs">
              {formatDayMonth(date)}
            </span>
          </Link>
        ))}
      </nav>
      <div className="flex gap-1">
        <IconButton
          icon="bookmarks"
          label="Saved outfits"
          disabled={busy}
          onClick={() => onPanel('outfits')}
        />
        <IconButton
          icon="laundry"
          label="Laundry"
          disabled={
            busy || controller.planSave.saving || controller.planSave.failed
          }
          onClick={() => onPanel('laundry')}
        />
      </div>
    </div>
  );
};
export const PlanningHeading = ({
  controller,
}: {
  readonly controller: PlanningController;
}) => {
  const { view, entries, basedOn } = controller;
  const worn = view.day.worn !== null;
  let eyebrow =
    view.day.today > view.actualToday ? 'Tomorrow’s plan' : 'Today’s plan';
  let title =
    view.day.today > view.actualToday
      ? 'Tomorrow starts here.'
      : 'What will you wear?';
  if (worn) {
    eyebrow = 'Worn today';
    title = 'Today, dressed.';
  }
  return (
    <section>
      <p className="type-eyebrow">{eyebrow}</p>
      <h1 className="type-display mt-2 text-4xl text-ink sm:text-5xl">
        {title}
      </h1>
      {basedOn === null ? null : (
        <p className="mt-3 text-ink-muted text-sm">Based on {basedOn}</p>
      )}
      {entries.length === 0 ? (
        <p className="mt-3 text-ink-muted">
          Choose a piece or let Rota suggest an outfit.
        </p>
      ) : null}
      {view.day.problem === null || worn ? null : (
        <Notice className="mt-5">
          {view.day.problem.message}
          <span className="mt-2 block">
            <Link
              className={linkButtonClass}
              to={
                view.day.problem.kind === 'location-missing'
                  ? '/settings'
                  : '/wardrobe'
              }
            >
              {view.day.problem.kind === 'location-missing'
                ? 'Choose location'
                : 'Open wardrobe'}
            </Link>
          </span>
        </Notice>
      )}
      {view.warnings.length === 0 || worn ? null : (
        <ul className="mt-4 space-y-2 text-ink-muted text-sm">
          {view.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {worn ? null : (
        <div className="mt-4">
          <PlanSaveStatus controller={controller} />
          <DayPreferences controller={controller} />
        </div>
      )}
    </section>
  );
};

const PlanSaveStatus = ({
  controller,
}: {
  readonly controller: PlanningController;
}) => {
  const { view, planSave } = controller;
  const date = formatDayMonth(view.day.today);
  let label =
    view.plan.entries !== null || view.day.proposal !== null
      ? `Saved for ${date}`
      : 'Changes save automatically';
  if (planSave.saving) {
    label = 'Saving…';
  } else if (planSave.failed) {
    label = 'Could not save your latest changes.';
  }
  return (
    <div className="mb-4 text-sm">
      <p
        aria-label="Plan saving status"
        role="status"
        className="text-ink-muted"
      >
        {label}
      </p>
      {planSave.failed ? (
        <button
          className={linkButtonClass}
          onClick={planSave.retry}
          type="button"
        >
          Retry save
        </button>
      ) : null}
      <p className="mt-1 text-ink-muted text-xs">
        {view.day.today > view.actualToday
          ? `On ${date}, open Today and choose “Wear this” to record it.`
          : 'Choose “Wear this” when you wear the outfit.'}
      </p>
    </div>
  );
};
