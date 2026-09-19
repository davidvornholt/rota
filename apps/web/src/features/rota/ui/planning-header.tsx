import { Link } from '@tanstack/react-router';
import { addDays } from '#/shared/time/local-date.ts';
import {
  linkButtonClass,
  tabActiveClass,
  tabClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { DayPreferences } from './day-preferences.tsx';
import type { PlanningController } from './use-planning.ts';
import { sameEntries } from './use-planning.ts';

const planLabel = ({ view, entries }: PlanningController): string => {
  if (view.plan.entries === null) {
    return 'Your outfit';
  }
  return sameEntries(entries, view.plan.entries)
    ? 'Plan saved'
    : 'Unsaved changes';
};
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
            disabled={busy}
            key={label}
            to="/"
            search={{ date }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex gap-5">
        <button
          className={linkButtonClass}
          disabled={busy}
          onClick={() => onPanel('outfits')}
          type="button"
        >
          Saved outfits
        </button>
        <button
          className={linkButtonClass}
          disabled={busy}
          onClick={() => onPanel('laundry')}
          type="button"
        >
          Laundry
        </button>
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
  let eyebrow = planLabel(controller);
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
          <DayPreferences controller={controller} />
        </div>
      )}
    </section>
  );
};
