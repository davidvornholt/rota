import { useState } from 'react';
import { checkClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { draftStatus } from './draft-status.ts';
import type { PlanningController } from './use-planning.ts';

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
      <div className="flex flex-wrap items-center gap-2">
        {status.complete ? (
          <IconButton
            icon="refresh"
            label={status.suggestLabel}
            disabled={busy}
            onClick={() => act('suggest')}
          />
        ) : (
          <button
            className={signalButtonClass}
            disabled={busy}
            onClick={() => act('suggest')}
            type="button"
          >
            {status.suggestLabel}
          </button>
        )}
        {status.complete ? (
          <button
            className={signalButtonClass}
            disabled={disabled || (status.tomorrow && status.saved)}
            onClick={() => act(status.tomorrow ? 'plan' : 'wear')}
            type="button"
          >
            {status.primaryLabel}
          </button>
        ) : null}
        {!status.tomorrow && status.complete ? (
          <IconButton
            icon="clock"
            label={status.saved ? 'Plan saved' : 'Save for later today'}
            disabled={disabled || status.saved}
            onClick={() => act('plan')}
          />
        ) : null}
        {status.complete ? (
          <IconButton
            icon="bookmark"
            label="Save as an outfit"
            disabled={busy}
            onClick={onSaveOutfit}
          />
        ) : null}
      </div>
    </div>
  );
};
