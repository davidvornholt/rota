import { Bookmark, RotateCw } from 'lucide-react';
import { useState } from 'react';
import {
  checkClass,
  linkButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
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
  const { entries, pinned, busy, planSave } = controller;
  const [override, setOverride] = useState(false);
  const status = draftStatus(controller);
  const pending = busy || planSave.saving || planSave.failed;
  const disabled =
    pending || status.unavailable || (status.concerns.length > 0 && !override);
  const wear = status.complete && !status.tomorrow;
  const act = (action: 'suggest' | 'wear') => {
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
          {status.concerns.join(' ')}
          {wear ? (
            <label className="mt-2 flex min-h-11 items-center gap-3">
              <input
                className={checkClass}
                type="checkbox"
                checked={override}
                onChange={(event) => setOverride(event.target.checked)}
              />
              Wear these pieces anyway
            </label>
          ) : null}
        </Notice>
      )}
      {status.unavailableMessage === null ? null : (
        <Notice>{status.unavailableMessage}</Notice>
      )}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
        <button
          className={signalButtonClass}
          disabled={wear ? disabled : pending}
          onClick={() => act(wear ? 'wear' : 'suggest')}
          type="button"
        >
          {wear ? 'Wear this' : status.suggestLabel}
        </button>
        {wear ? (
          <button
            className={[linkButtonClass, 'gap-2'].join(' ')}
            disabled={pending}
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
      <p className="max-w-sm text-ink-muted text-xs">
        Checked pieces stay in your next suggestion. Keeping a piece does not
        record wear.
      </p>
      {status.complete ? (
        <button
          className={[linkButtonClass, 'gap-2'].join(' ')}
          disabled={pending}
          onClick={onSaveOutfit}
          type="button"
        >
          <Bookmark
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.5}
          />
          Save as a reusable outfit
        </button>
      ) : null}
    </div>
  );
};
