import { useId, useState } from 'react';
import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import { linkButtonClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import type { ProposalView } from '../schemas/today-view.ts';
import { alternativesFn } from '../services/today-fns.ts';
import { OccasionNote } from './occasion-note.tsx';
import { OutfitRow } from './outfit-row.tsx';
import { SwapSheet } from './swap-sheet.tsx';
import type { TodayController } from './use-today.ts';

type ProposalSectionProps = {
  readonly proposal: ProposalView;
  readonly today: TodayController;
};

const eyebrowFor = (rerolling: boolean, edited: boolean): string => {
  if (rerolling) {
    return 'Choosing again';
  }
  return edited ? 'Your outfit' : 'Proposed';
};

const Deciding = () => (
  <section aria-live="polite" className="py-10">
    <p className="type-eyebrow">Deciding</p>
    <p className="type-display mt-2 text-3xl text-ink sm:text-4xl">
      Reading the forecast and the rota …
    </p>
    <p className="mt-3 max-w-prose text-ink-muted">
      The wardrobe narrows the choice and the model weighs it. This takes a
      moment the first time each day.
    </p>
  </section>
);

/** Wear this, another suggestion, start over: the same three verbs wherever they sit. */
const Actions = ({
  today,
  layout,
}: {
  readonly today: TodayController;
  readonly layout: 'column' | 'bar';
}) => (
  <>
    <button
      aria-busy={today.logging}
      className={[signalButtonClass, 'w-full text-base'].join(' ')}
      disabled={today.busy}
      onClick={today.wear}
      type="button"
    >
      {today.logging ? 'Logging …' : 'Wear this'}
    </button>
    <div
      className={
        layout === 'column'
          ? 'flex flex-wrap gap-x-5 gap-y-1'
          : 'mt-2 flex justify-between'
      }
    >
      <button
        className={linkButtonClass}
        disabled={today.busy}
        onClick={() => today.reroll('boundary')}
        type="button"
      >
        Another suggestion
      </button>
      <button
        className={linkButtonClass}
        disabled={today.busy}
        onClick={() => today.reroll('all')}
        type="button"
      >
        Start over
      </button>
    </div>
  </>
);

const optionalSlots: ReadonlyArray<Slot> = ['under', 'over'];

const OutfitList = ({ today }: { readonly today: TodayController }) => {
  const [swapping, setSwapping] = useState<Slot | null>(null);
  const currentIds = today.draftItems.map((item) => item.garment.id);
  const sheetFor = (slot: Slot) => (
    <SwapSheet
      currentIds={currentIds}
      load={(forSlot, ids) =>
        alternativesFn({ data: { slot: forSlot, currentIds: [...ids] } })
      }
      onClose={() => setSwapping(null)}
      onPick={(garment) => {
        today.pick(slot, garment);
        setSwapping(null);
      }}
      slot={slot}
    />
  );
  const open = optionalSlots.filter(
    (slot) => !today.draftItems.some((item) => item.slot === slot),
  );
  return (
    <>
      <ul className="border-rule border-b">
        {today.draftItems.map((item) => (
          <OutfitRow
            actions={
              <>
                <button
                  className={linkButtonClass}
                  onClick={() => setSwapping(item.slot)}
                  type="button"
                >
                  Swap
                </button>
                {optionalSlots.includes(item.slot) ? (
                  <IconButton
                    icon="close"
                    label={`Remove ${slotLabel[item.slot].toLowerCase()}`}
                    onClick={() => today.remove(item.slot)}
                  />
                ) : null}
              </>
            }
            budget={item.budget}
            continued={item.continued}
            dayOfBudget={item.dayOfBudget}
            garment={item.garment}
            key={item.slot}
            reason={item.reason}
            slot={item.slot}
          />
        ))}
      </ul>
      {swapping === null ? null : sheetFor(swapping)}
      {open.length > 0 ? (
        <p className="mt-3 flex flex-wrap gap-x-5">
          {open.map((slot) => (
            <button
              className={linkButtonClass}
              key={slot}
              onClick={() => setSwapping(slot)}
              type="button"
            >
              Add {slotLabel[slot].toLowerCase()}
            </button>
          ))}
        </p>
      ) : null}
    </>
  );
};

/**
 * The proposal: the model's headline and the outfit as a list, with the
 * actions beside it on wide screens and in a bar above the tab strip on a
 * phone, so confirming is one thumb away.
 */
export const ProposalSection = ({ proposal, today }: ProposalSectionProps) => {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12"
    >
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-8">
          <p className="type-eyebrow">
            {eyebrowFor(today.rerolling, today.edited)}
          </p>
          <h2
            className={[
              'type-display mt-2 text-3xl sm:text-4xl lg:text-5xl',
              today.rerolling ? 'text-ink-faint' : 'text-ink',
            ].join(' ')}
            id={headingId}
          >
            {today.rerolling ? 'One moment …' : proposal.headline}
          </h2>
          {proposal.forecastStale ? (
            <p className="mt-3 text-ink-faint text-sm">
              Decided on yesterday's forecast; today's could not be fetched.
            </p>
          ) : null}
          <div className="mt-8 hidden flex-col gap-3 lg:flex">
            <Actions layout="column" today={today} />
          </div>
          <div className="mt-8">
            <OccasionNote
              occasion={today.view.occasion}
              onSave={today.saveOccasion}
              pending={today.savingOccasion}
              remakes={true}
            />
          </div>
        </div>
      </div>
      <div className="lg:col-span-7">
        {today.rerolling ? <Deciding /> : <OutfitList today={today} />}
      </div>
      <div className="sticky bottom-16 z-10 -mx-5 border-rule border-t bg-paper px-5 py-3 sm:-mx-8 sm:px-8 lg:hidden">
        <Actions layout="bar" today={today} />
      </div>
    </section>
  );
};

export { Deciding };
