import { useState } from 'react';
import { hasWearBudget } from '#/shared/data/garment-types.ts';
import {
  checkClass,
  linkButtonClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { careLabel } from './care-label.ts';
import type { PlanningController } from './use-planning.ts';

export const LaundryPanel = ({
  controller,
  onClose,
}: {
  readonly controller: PlanningController;
  readonly onClose: () => void;
}) => {
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const [error, setError] = useState('');
  const garments = controller.view.wardrobe
    .filter((garment) => hasWearBudget(garment) || garment.inLaundry)
    .sort(
      (a, b) =>
        Number(b.inLaundry) - Number(a.inLaundry) ||
        b.wearsSinceWash - a.wearsSinceWash,
    );
  const change = async (care: 'laundry' | 'washed') => {
    try {
      await controller.change({ action: 'care', care, ids: selected });
      setSelected([]);
      setError('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not update laundry. Try again.',
      );
    }
  };
  return (
    <Dialog
      title="Laundry"
      open={true}
      onClose={controller.busy ? () => undefined : onClose}
    >
      {error === '' ? null : <Notice live={true}>{error}</Notice>}
      <div className="flex items-center justify-between gap-4">
        <p className="text-ink-muted text-sm">
          Select pieces to wash or put away.
        </p>
        <button
          className={linkButtonClass}
          disabled={controller.busy}
          onClick={() =>
            setSelected(
              garments
                .filter((item) => item.inLaundry || item.wearsSinceWash > 0)
                .map((item) => item.id),
            )
          }
          type="button"
        >
          Select worn
        </button>
      </div>
      <ul className="mt-4 divide-y divide-rule">
        {garments.map((garment) => (
          <li key={garment.id}>
            <label className="flex min-h-16 items-center gap-4 py-3">
              <input
                className={checkClass}
                checked={selected.includes(garment.id)}
                disabled={controller.busy}
                onChange={() =>
                  setSelected((ids) =>
                    ids.includes(garment.id)
                      ? ids.filter((id) => id !== garment.id)
                      : [...ids, garment.id],
                  )
                }
                type="checkbox"
              />
              <span className="flex-1">
                {garment.name}
                <span className="mt-1 block text-ink-muted text-xs">
                  {careLabel(garment)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {garments.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          Clothes you add to your wardrobe will appear here.
        </p>
      ) : null}
      <div className="sticky bottom-0 mt-5 flex flex-wrap gap-3 bg-paper py-3">
        <button
          className={quietButtonClass}
          disabled={controller.busy || selected.length === 0}
          onClick={() => {
            change('laundry').catch(() => undefined);
          }}
          type="button"
        >
          Put in laundry
        </button>
        <button
          className={signalButtonClass}
          disabled={controller.busy || selected.length === 0}
          onClick={() => {
            change('washed').catch(() => undefined);
          }}
          type="button"
        >
          Mark washed
        </button>
      </div>
    </Dialog>
  );
};
