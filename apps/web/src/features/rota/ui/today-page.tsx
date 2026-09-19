import { useState } from 'react';
import { frameClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { IconLink } from '#/shared/ui/icon-link.tsx';
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
const failureMessage = (failure: unknown) =>
  failure instanceof Error ? failure.message : 'Could not save. Try again.';
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
          {failureMessage(failure)}
        </Notice>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-x-16">
        <div className="lg:col-start-1">
          <PlanningHeading controller={controller} />
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {worn ? (
              <IconLink
                icon="edit"
                label="Edit what you wore"
                linkOptions={{
                  to: '/history/$date',
                  params: { date: view.day.today },
                }}
              />
            ) : (
              <PlanningActions
                key={entries.map((entry) => entry.garmentId).join(',')}
                controller={controller}
                onSaveOutfit={() => setOpen('save')}
              />
            )}
            {complete && worn ? (
              <IconButton
                icon="bookmark"
                label="Save as an outfit"
                disabled={busy}
                onClick={() => setOpen('save')}
              />
            ) : null}
          </div>
          <p className="mt-3 text-ink-muted text-sm" role="status">
            {controller.message}
          </p>
        </div>
        <div className="lg:col-start-2 lg:row-start-1">
          <OutfitEditor
            entries={entries}
            wardrobe={view.wardrobe}
            onChange={controller.setEntries}
            pinned={controller.pinned}
            onPin={worn ? null : controller.pin}
            disabled={busy || worn}
            readOnly={worn}
            laundryDisabled={busy}
            onLaundry={(id) => {
              controller.care(id, 'laundry').catch(() => undefined);
            }}
          />
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
