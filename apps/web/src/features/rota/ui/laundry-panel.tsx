import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { addDays, formatDayMonth } from '#/shared/time/local-date.ts';
import { linkButtonClass } from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { EarlyLaundry } from './early-laundry.tsx';
import type { PlanningController } from './use-planning.ts';

const recentReturnDays = 7;

const LaundryItem = ({
  garment,
  status,
  children,
}: {
  readonly garment: GarmentView;
  readonly status: string;
  readonly children: ReactNode;
}) => (
  <li className="flex items-center gap-4 py-4">
    <GarmentFigure
      alt=""
      className="w-16 shrink-0 sm:w-20"
      colors={garment.colors}
      image={garment.image}
      name={garment.name}
    />
    <span className="min-w-0 flex-1 break-words">
      {garment.name}
      <span className="mt-1 block text-ink-muted text-xs">{status}</span>
    </span>
    {children}
  </li>
);

export const LaundryPanel = ({
  controller,
  onClose,
}: {
  readonly controller: PlanningController;
  readonly onClose: () => void;
}) => {
  const [error, setError] = useState('');
  const [early, setEarly] = useState('');
  const [picking, setPicking] = useState(false);
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
    <>
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
                <LaundryItem
                  key={garment.id}
                  garment={garment}
                  status={`Expected ${garment.readyOn === null ? 'soon' : formatDayMonth(garment.readyOn)}`}
                >
                  <IconButton
                    icon="check"
                    label={`Back clean: ${garment.name}`}
                    disabled={careDisabled}
                    onClick={() => {
                      change(garment.id, 'washed').catch(() => undefined);
                    }}
                  />
                </LaundryItem>
              ))}
            </ul>
          </section>
        )}
        {returned.length === 0 ? null : (
          <section className="mt-6" aria-label="Expected back">
            <h3 className="type-eyebrow">Expected back</h3>
            <ul className="mt-2 divide-y divide-rule">
              {returned.map((garment) => (
                <LaundryItem
                  key={garment.id}
                  garment={garment}
                  status="Available again"
                >
                  <IconButton
                    icon="clock"
                    label={`Still in laundry: ${garment.name}`}
                    disabled={careDisabled}
                    onClick={() => {
                      change(garment.id, 'postpone').catch(() => undefined);
                    }}
                  />
                </LaundryItem>
              ))}
            </ul>
          </section>
        )}
        <EarlyLaundry
          selected={selected}
          disabled={careDisabled}
          onChoose={() => setPicking(true)}
          onSend={() => {
            change(early, 'laundry').catch(() => undefined);
          }}
        />
        <p role="status" className="mt-3 text-ink-muted text-sm">
          {message}
        </p>
      </Dialog>
      {picking ? (
        <GarmentPicker
          eyebrow="Laundry"
          title="Choose a piece"
          groups={[
            { garments: garments.filter((garment) => !garment.inLaundry) },
          ]}
          nothingFits="No pieces available to send to laundry."
          selectedId={selected?.id}
          onPick={(garment) => {
            setEarly(garment.id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
};
