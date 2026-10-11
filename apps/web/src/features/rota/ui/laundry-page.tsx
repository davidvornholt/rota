import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { addDays, formatDayMonth } from '#/shared/time/local-date.ts';
import { frameClass, linkButtonClass } from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import type { PlanningView } from '../schemas/planning-view.ts';
import { dayEntries } from './day-entries.ts';
import { EarlyLaundry } from './early-laundry.tsx';
import { usePlanningChange } from './use-planning-change.ts';

const recentReturnDays = 7;

type Care = 'laundry' | 'washed' | 'postpone';

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
      sizes="(min-width: 640px) 5rem, 4rem"
    />
    <span className="min-w-0 flex-1 break-words">
      {garment.name}
      <span className="mt-1 block text-ink-muted text-xs">{status}</span>
    </span>
    {children}
  </li>
);

/**
 * A piece sent to laundry early leaves today's outfit too, so the outfit is
 * saved without it, unless the day is already recorded as worn.
 */
const draftFor = (view: PlanningView, id: string, care: Care) => {
  const entries = dayEntries(view);
  return care === 'laundry' &&
    view.day.worn === null &&
    entries.some((entry) => entry.garmentId === id)
    ? { entries, basedOn: view.plan.basedOn }
    : null;
};

/** What is in the laundry, what came back, and sending a piece early. */
export const LaundryPage = ({
  initial,
}: {
  readonly initial: PlanningView;
}) => {
  const { view, busy, change } = usePlanningChange(initial);
  const [error, setError] = useState('');
  const [early, setEarly] = useState('');
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState('');
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
  const care = async (id: string, next: Care) => {
    setError('');
    try {
      await change({
        action: 'care',
        ids: [id],
        care: next,
        draft: draftFor(view, id, next),
      });
      setEarly('');
      setMessage(
        next === 'postpone'
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
    <div className={frameClass}>
      <div className="border-rule border-b pb-4">
        <h1 className="type-display text-4xl text-ink sm:text-5xl">Laundry</h1>
        <p className="type-data mt-1 text-ink-muted text-sm">
          {waiting.length} piece{waiting.length === 1 ? '' : 's'} in laundry
        </p>
      </div>
      <div className="max-w-2xl">
        <p className="mt-5 text-ink-muted text-sm">
          After its final wear before washing, each piece is expected back clean
          in {view.laundryDays} days.{' '}
          <Link to="/settings" className={linkButtonClass}>
            Change
          </Link>
        </p>
        {error === '' ? null : (
          <Notice className="mt-5" live={true}>
            {error}
          </Notice>
        )}
        {waiting.length === 0 ? (
          <p className="mt-6 text-ink-muted">Nothing waiting on laundry.</p>
        ) : (
          <section className="mt-6" aria-label="In laundry">
            <h2 className="type-eyebrow">In laundry</h2>
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
                    disabled={busy}
                    onClick={() => {
                      care(garment.id, 'washed').catch(() => undefined);
                    }}
                  />
                </LaundryItem>
              ))}
            </ul>
          </section>
        )}
        {returned.length === 0 ? null : (
          <section className="mt-6" aria-label="Expected back">
            <h2 className="type-eyebrow">Expected back</h2>
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
                    disabled={busy}
                    onClick={() => {
                      care(garment.id, 'postpone').catch(() => undefined);
                    }}
                  />
                </LaundryItem>
              ))}
            </ul>
          </section>
        )}
        <EarlyLaundry
          selected={selected}
          disabled={busy}
          onChoose={() => setPicking(true)}
          onSend={() => {
            care(early, 'laundry').catch(() => undefined);
          }}
        />
        <p role="status" className="mt-3 text-ink-muted text-sm">
          {message}
        </p>
      </div>
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
    </div>
  );
};
