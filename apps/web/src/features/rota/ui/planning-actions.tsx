import { Bookmark, Clock, RotateCw } from 'lucide-react';
import { useState } from 'react';
import {
  checkClass,
  linkButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { draftStatus } from './draft-status.ts';
import type { PlanningController } from './use-planning.ts';

const PlanningSaveOptions = ({
  status,
  disabled,
  busy,
  onPlan,
  onSaveOutfit,
}: {
  readonly status: Pick<ReturnType<typeof draftStatus>, 'tomorrow' | 'saved'>;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly onPlan: () => void;
  readonly onSaveOutfit: () => void;
}) => (
  <details>
    <summary className="w-fit cursor-pointer py-2 text-ink-muted text-sm hover:text-ink">
      More options
    </summary>
    <div className="mt-1 flex flex-col items-start border-rule border-l pl-4">
      {status.tomorrow ? null : (
        <button
          className={[linkButtonClass, 'gap-2'].join(' ')}
          disabled={disabled || status.saved}
          onClick={onPlan}
          type="button"
        >
          <Clock
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.5}
          />
          {status.saved ? 'Plan saved' : 'Save for later today'}
        </button>
      )}
      <button
        className={[linkButtonClass, 'gap-2'].join(' ')}
        disabled={busy}
        onClick={onSaveOutfit}
        type="button"
      >
        <Bookmark
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={1.5}
        />
        Save as an outfit
      </button>
    </div>
  </details>
);

export const PlanningActions = ({
  controller,
  onSaveOutfit,
}: {
  readonly controller: PlanningController;
  readonly onSaveOutfit: () => void;
}) => {
  const { entries, pinned, busy } = controller;
  const [override, setOverride] = useState(false);
  const status = draftStatus(controller);
  const disabled =
    busy || status.unavailable || (status.concerns.length > 0 && !override);
  const outfitAction = status.tomorrow ? 'plan' : 'wear';
  const act = (action: 'suggest' | 'plan' | 'wear') => {
    controller
      .change({
        action,
        entries:
          action === 'suggest'
            ? entries.filter((entry) => pinned.includes(entry.garmentId))
            : entries,
        basedOn: controller.basedOn,
      })
      .catch(() => undefined);
  };
  return (
    <div className="space-y-4">
      {status.concerns.length === 0 ? null : (
        <Notice>
          <ul>
            {status.concerns.map((concern) => (
              <li key={concern}>{concern}</li>
            ))}
          </ul>
          <label className="mt-2 flex min-h-11 items-center gap-3">
            <input
              className={checkClass}
              type="checkbox"
              checked={override}
              onChange={(event) => setOverride(event.target.checked)}
            />
            Use these pieces anyway
          </label>
        </Notice>
      )}
      {status.unavailableMessage === null ? null : (
        <Notice>{status.unavailableMessage}</Notice>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          className={signalButtonClass}
          disabled={
            status.complete
              ? disabled || (status.tomorrow && status.saved)
              : busy
          }
          onClick={() => act(status.complete ? outfitAction : 'suggest')}
          type="button"
        >
          {status.complete ? status.primaryLabel : status.suggestLabel}
        </button>
        {status.complete ? (
          <button
            className={[linkButtonClass, 'gap-2'].join(' ')}
            disabled={busy}
            onClick={() => act('suggest')}
            type="button"
          >
            <RotateCw
              aria-hidden="true"
              className="size-4 shrink-0"
              strokeWidth={1.5}
            />
            {status.suggestLabel}
          </button>
        ) : null}
      </div>
      {status.complete ? (
        <PlanningSaveOptions
          status={status}
          disabled={disabled}
          busy={busy}
          onPlan={() => act('plan')}
          onSaveOutfit={onSaveOutfit}
        />
      ) : null}
    </div>
  );
};
