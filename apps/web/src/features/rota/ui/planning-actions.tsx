import { useState } from 'react';
import {
  checkClass,
  linkButtonClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { draftStatus } from './draft-status.ts';
import type { PlanningController } from './use-planning.ts';

export const PlanningActions = ({
  controller,
}: {
  readonly controller: PlanningController;
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
      {status.unavailable ? (
        <Notice>
          A piece is unavailable. Choose a replacement or mark it washed in
          Laundry.
        </Notice>
      ) : null}
      <div className="flex flex-col gap-3">
        <button
          className={status.complete ? quietButtonClass : signalButtonClass}
          disabled={busy}
          onClick={() => act('suggest')}
          type="button"
        >
          {status.suggestLabel}
        </button>
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
          <button
            className={linkButtonClass}
            disabled={disabled || status.saved}
            onClick={() => act('plan')}
            type="button"
          >
            {status.saved ? 'Plan saved' : 'Save for later today'}
          </button>
        ) : null}
      </div>
      {pinned.length === 0 ? null : (
        <p className="text-ink-muted text-xs">
          Kept pieces stay when Rota completes your outfit.
        </p>
      )}
    </div>
  );
};
