import { useId } from 'react';

import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { fieldClass } from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';

type SlotPickerProps = {
  readonly slot: Slot;
  readonly chosen: GarmentView | undefined;
  readonly candidates: ReadonlyArray<GarmentView>;
  readonly onChange: (garmentId: string) => void;
};

/** One slot of a logged day: a select over the garments that fit it, the picture beside it is what is chosen. */
export const SlotPicker = ({
  slot,
  chosen,
  candidates,
  onChange,
}: SlotPickerProps) => {
  const selectId = useId();
  const required = slot === 'bottom' || slot === 'top';
  return (
    <li className="grid grid-cols-[5rem_1fr] items-center gap-4 border-rule border-t py-3 sm:grid-cols-[6rem_1fr] sm:gap-6">
      <GarmentFigure
        alt=""
        colors={chosen?.colors}
        image={chosen?.image}
        name={chosen?.name ?? '·'}
      />
      <div>
        <label className="type-eyebrow" htmlFor={selectId}>
          {slotLabel[slot]}
        </label>
        <select
          className={[fieldClass, 'mt-1'].join(' ')}
          id={selectId}
          onChange={(event) => onChange(event.target.value)}
          value={chosen?.id ?? ''}
        >
          <option value="">{required ? 'Not logged' : 'None'}</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
              {candidate.status === 'retired' ? ' (retired)' : ''}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
};
