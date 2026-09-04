import type { ReactNode } from 'react';
import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { Swatches } from '#/shared/ui/swatches.tsx';
import { Tally } from '#/shared/ui/tally.tsx';
import { tallyLabel } from '#/shared/ui/tally-label.ts';

type OutfitRowProps = {
  readonly slot: Slot;
  readonly garment: GarmentView;
  readonly dayOfBudget: number;
  readonly budget: number;
  readonly continued: boolean;
  readonly reason: string;
  readonly animateTally?: boolean;
  /** Actions for this garment (swap, skip); rendered under the reason. */
  readonly actions?: ReactNode;
  readonly emphasis?: 'proposal' | 'receipt';
};

/**
 * One garment of the outfit: picture, name in the serif, slot, tally, and the
 * reason it is there. Rows separate by a hairline, not by boxes, so the outfit
 * reads as one list from trousers up.
 */
export const OutfitRow = ({
  slot,
  garment,
  dayOfBudget,
  budget,
  continued,
  reason,
  animateTally = false,
  actions,
  emphasis = 'proposal',
}: OutfitRowProps) => (
  <li className="grid grid-cols-[6rem_1fr] gap-4 border-rule border-t py-4 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:py-5">
    <GarmentFigure
      alt=""
      colors={garment.colors}
      image={garment.image}
      loading="eager"
      name={garment.name}
    />
    <div className="flex min-w-0 flex-col justify-between gap-3">
      <div>
        <p className="type-eyebrow">
          {slotLabel[slot]}
          {continued ? ' · continuing' : ' · fresh'}
        </p>
        <p className="type-display mt-1 text-2xl text-ink sm:text-3xl">
          {garment.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Tally animateLatest={animateTally} day={dayOfBudget} of={budget} />
          <span className="type-data text-ink-faint text-xs">
            {tallyLabel(dayOfBudget, budget)}
          </span>
          <Swatches colors={garment.colors} />
        </div>
        {reason === '' ? null : (
          <p
            className={[
              'mt-3 max-w-prose text-sm leading-relaxed',
              emphasis === 'receipt' ? 'text-ink-faint' : 'text-ink-muted',
            ].join(' ')}
          >
            {reason}
          </p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex flex-wrap gap-x-5 gap-y-1">{actions}</div>
      )}
    </div>
  </li>
);
