import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { frameClass, linkButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import type { PlanningView } from '../schemas/planning-view.ts';
import { backfillFn } from '../services/today-fns.ts';
import { BackfillPrompt } from './backfill-prompt.tsx';
import { completeOutfit } from './draft-status.ts';
import { LaundryPanel } from './laundry-panel.tsx';
import { OutfitEditor } from './outfit-editor.tsx';
import { OutfitsPanel } from './outfits-panel.tsx';
import { PlanningActions } from './planning-actions.tsx';
import { PlanningHeading, PlanningNavigation } from './planning-header.tsx';
import { usePlanning } from './use-planning.ts';
import { WeatherStrip } from './weather-strip.tsx';

type Panel = 'outfits' | 'save' | 'laundry' | null;
export const TodayPage = ({
  initial,
  seed,
  savedOutfitId,
  panel,
}: {
  readonly initial: PlanningView;
  readonly seed?: string;
  readonly savedOutfitId?: string;
  readonly panel?: 'outfits' | 'laundry';
}) => {
  const controller = usePlanning(initial, {
    garment: seed,
    outfit: savedOutfitId,
  });
  const { view, entries, busy } = controller;
  const [open, setOpen] = useState<Panel>(panel ?? null);
  const [dismissed, setDismissed] = useState(false);
  const [backfillError, setBackfillError] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const worn = view.day.worn !== null;
  const { failure } = controller;
  const complete = completeOutfit(entries);
  return (
    <div className={frameClass}>
      <PlanningNavigation controller={controller} onPanel={setOpen} />
      <WeatherStrip
        locationLabel={view.day.locationLabel}
        stale={view.day.forecastStale}
        today={view.day.today}
        weather={view.day.weather}
      />
      {view.day.unlogged === null || dismissed ? null : (
        <div className="mt-6">
          <BackfillPrompt
            gap={view.day.unlogged}
            onDismiss={() => setDismissed(true)}
            pending={busy || backfilling}
            onSame={(gap) => {
              setBackfilling(true);
              setBackfillError('');
              backfillFn({ data: { date: gap.from, copyFrom: gap.lastLogged } })
                .then(() => {
                  setDismissed(true);
                  controller.refresh();
                })
                .catch((error: unknown) =>
                  setBackfillError(
                    error instanceof Error
                      ? error.message
                      : 'Could not log the day. Try again.',
                  ),
                )
                .finally(() => setBackfilling(false));
            }}
          />
        </div>
      )}
      {backfillError === '' ? null : (
        <Notice live={true}>{backfillError}</Notice>
      )}
      {failure === null ? null : (
        <Notice className="mt-5" live={true}>
          {failure instanceof Error
            ? failure.message
            : 'Could not save. Try again.'}
        </Notice>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-16 lg:gap-y-6">
        <div className="lg:col-start-1">
          <PlanningHeading controller={controller} />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <OutfitEditor
            entries={entries}
            wardrobe={view.wardrobe}
            onChange={controller.setEntries}
            pinned={controller.pinned}
            onPin={worn ? null : controller.pin}
            disabled={busy || worn}
          />
        </div>
        <div className="lg:col-start-1 lg:self-start">
          <div className="mt-6">
            {worn ? (
              <Link
                className={linkButtonClass}
                to="/history/$date"
                params={{ date: view.day.today }}
              >
                Edit what you wore
              </Link>
            ) : (
              <PlanningActions
                key={entries.map((entry) => entry.garmentId).join(',')}
                controller={controller}
              />
            )}
          </div>
          {complete ? (
            <button
              className={[linkButtonClass, 'mt-3'].join(' ')}
              disabled={busy}
              onClick={() => setOpen('save')}
              type="button"
            >
              Save as an outfit
            </button>
          ) : null}
          <p className="mt-3 text-ink-muted text-sm" role="status">
            {controller.message}
          </p>
        </div>
      </div>
      {open === 'outfits' || open === 'save' ? (
        <OutfitsPanel
          controller={controller}
          saveCurrent={open === 'save'}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'laundry' ? (
        <LaundryPanel controller={controller} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
};
