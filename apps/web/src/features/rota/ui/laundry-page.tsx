import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { hasWearBudget } from '#/shared/data/garment-types.ts';
import { formatDayMonth } from '#/shared/time/local-date.ts';
import { frameClass, linkButtonClass } from '#/shared/ui/classes.ts';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import type { PlanningView } from '../schemas/planning-view.ts';
import { dayEntries } from './day-entries.ts';
import { EarlyLaundry } from './early-laundry.tsx';
import { LaundryItem } from './laundry-item.tsx';
import { backFromLaundry, wornSinceWashing } from './laundry-lists.ts';
import { usePlanningChange } from './use-planning-change.ts';
import { WornSinceWashing } from './worn-since-washing.tsx';

type Care = 'laundry' | 'washed' | 'postpone';

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
  const worn = wornSinceWashing(garments);
  const returned = backFromLaundry(garments, view.actualToday);
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
      {/*
        On a wide screen the lists take the main column and the notes and the
        early-laundry form sit beside the list they belong to: the return
        rule beside what is in laundry, the form beside what was worn. A phone
        keeps one column in the same order.
      */}
      <div className="max-w-2xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-x-16">
        <p className="mt-5 text-ink-muted text-sm lg:col-start-2 lg:row-start-2 lg:mt-6">
          After its final wear before washing, each piece is expected back clean
          in {view.laundryDays} days.{' '}
          <Link to="/settings" className={linkButtonClass}>
            Change
          </Link>
        </p>
        {error === '' ? null : (
          <Notice className="mt-5 lg:col-span-2 lg:row-start-1" live={true}>
            {error}
          </Notice>
        )}
        {waiting.length === 0 ? (
          <p className="mt-6 text-ink-muted lg:col-start-1 lg:row-start-2">
            Nothing waiting on laundry.
          </p>
        ) : (
          <section
            className="mt-6 lg:col-start-1 lg:row-start-2"
            aria-label="In laundry"
          >
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
        <div className="lg:col-start-1 lg:row-start-3">
          <WornSinceWashing
            garments={worn}
            disabled={busy}
            onBasket={(id) => {
              care(id, 'laundry').catch(() => undefined);
            }}
            onWashed={(id) => {
              care(id, 'washed').catch(() => undefined);
            }}
          />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-3">
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
        {returned.length === 0 ? null : (
          <section
            className="mt-6 lg:col-start-1 lg:row-start-4"
            aria-label="Back from laundry"
          >
            <h2 className="type-eyebrow">Back from laundry</h2>
            <ul className="mt-2 divide-y divide-rule">
              {returned.map((garment) => (
                <LaundryItem
                  key={garment.id}
                  garment={garment}
                  status={`Counted as back on ${formatDayMonth(garment.assumedCleanOn)}`}
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
