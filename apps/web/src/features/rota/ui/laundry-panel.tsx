import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { hasWearBudget } from '#/shared/data/garment-types.ts';
import { addDays, formatDayMonth } from '#/shared/time/local-date.ts';
import {
  fieldClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import type { PlanningController } from './use-planning.ts';

const recentReturnDays = 7;

export const LaundryPanel = ({
  controller,
  onClose,
}: {
  readonly controller: PlanningController;
  readonly onClose: () => void;
}) => {
  const [error, setError] = useState('');
  const [early, setEarly] = useState('');
  const [message, setMessage] = useState('');
  const { view, busy } = controller;
  const careDisabled =
    busy || controller.planSave.saving || controller.planSave.failed;
  const garments = view.laundry.filter((garment) => hasWearBudget(garment));
  const selected = garments.find((garment) => garment.id === early);
  const waiting = garments.filter((garment) => garment.inLaundry);
  const returned = garments.filter(
    (garment) =>
      !garment.inLaundry &&
      garment.wearsSinceWash === 0 &&
      garment.assumedCleanOn !== null &&
      garment.assumedCleanOn >= addDays(view.actualToday, -recentReturnDays),
  );
  const change = async (
    id: string,
    care: 'laundry' | 'washed' | 'postpone',
  ) => {
    setError('');
    try {
      await controller.care(id, care);
      setEarly('');
      setMessage(
        care === 'postpone'
          ? 'Kept in laundry until tomorrow.'
          : 'Laundry updated.',
      );
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
      onClose={busy ? () => undefined : onClose}
    >
      <p className="text-ink-muted text-sm">
        After its final wear before washing, each piece is expected back clean
        in {view.laundryDays} days.{' '}
        <Link to="/settings" className={linkButtonClass}>
          Change
        </Link>
      </p>
      {error === '' ? null : <Notice live={true}>{error}</Notice>}
      {waiting.length === 0 ? (
        <p className="mt-6 text-ink-muted">Nothing waiting on laundry.</p>
      ) : (
        <section className="mt-6" aria-label="In laundry">
          <h3 className="type-eyebrow">In laundry</h3>
          <ul className="mt-2 divide-y divide-rule">
            {waiting.map((garment) => (
              <li
                key={garment.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <span>
                  {garment.name}
                  <span className="mt-1 block text-ink-muted text-xs">
                    Expected{' '}
                    {garment.readyOn === null
                      ? 'soon'
                      : formatDayMonth(garment.readyOn)}
                  </span>
                </span>
                <IconButton
                  icon="check"
                  label={`Back clean: ${garment.name}`}
                  disabled={careDisabled}
                  onClick={() => {
                    change(garment.id, 'washed').catch(() => undefined);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {returned.length === 0 ? null : (
        <section className="mt-6" aria-label="Expected back">
          <h3 className="type-eyebrow">Expected back</h3>
          <ul className="mt-2 divide-y divide-rule">
            {returned.map((garment) => (
              <li
                key={garment.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <span>
                  {garment.name}
                  <span className="mt-1 block text-ink-muted text-xs">
                    Available again
                  </span>
                </span>
                <IconButton
                  icon="clock"
                  label={`Still in laundry: ${garment.name}`}
                  disabled={careDisabled}
                  onClick={() => {
                    change(garment.id, 'postpone').catch(() => undefined);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <details className="mt-5 border-rule border-t pt-4">
        <summary className="cursor-pointer py-2 text-sm">
          Send a piece to laundry early
        </summary>
        {selected === undefined ? null : (
          <figure className="mt-3 flex items-center gap-4">
            <GarmentFigure
              className="w-24 shrink-0"
              image={selected.image}
              name={selected.name}
              colors={selected.colors}
            />
            <figcaption className="type-display text-xl">
              {selected.name}
            </figcaption>
          </figure>
        )}
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            change(early, 'laundry').catch(() => undefined);
          }}
        >
          <label className="min-w-0 flex-1 text-sm">
            Piece
            <select
              className={[fieldClass, 'mt-2'].join(' ')}
              value={early}
              onChange={(event) => setEarly(event.target.value)}
              disabled={careDisabled}
              required={true}
            >
              <option value="">Choose a piece</option>
              {garments
                .filter((garment) => !garment.inLaundry)
                .map((garment) => (
                  <option key={garment.id} value={garment.id}>
                    {garment.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className={quietButtonClass}
            type="submit"
            disabled={careDisabled || early === ''}
          >
            Put in basket
          </button>
        </form>
      </details>
      <p role="status" className="mt-3 text-ink-muted text-sm">
        {message}
      </p>
    </Dialog>
  );
};
