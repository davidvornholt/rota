import { useState } from 'react';

import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { formatLongDate, type LocalDate } from '#/shared/time/local-date.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { Swatches } from '#/shared/ui/swatches.tsx';

type SlotPickerProps = {
  readonly day: LocalDate;
  readonly slot: Slot;
  readonly chosen: GarmentView | undefined;
  readonly candidates: ReadonlyArray<GarmentView>;
  /** The picked garment's id, or the empty string for nothing. */
  readonly onChange: (garmentId: string) => void;
};

/**
 * One slot of a logged day: the picture and name of what is chosen, and the
 * whole row is the button that opens the picture picker for the slot.
 */
export const SlotPicker = ({
  day,
  slot,
  chosen,
  candidates,
  onChange,
}: SlotPickerProps) => {
  const [open, setOpen] = useState(false);
  const required = slot === 'bottom' || slot === 'top';
  const emptyLabel = required ? 'Not logged' : 'None';
  return (
    <li className="border-rule border-t">
      <button
        className="group grid w-full grid-cols-[5rem_1fr] items-center gap-4 py-3 text-left sm:grid-cols-[6rem_1fr] sm:gap-6"
        onClick={() => setOpen(true)}
        type="button"
      >
        <GarmentFigure
          alt=""
          className="border border-transparent transition-colors group-hover:border-ink"
          colors={chosen?.colors}
          image={chosen?.image}
          name={chosen?.name ?? '·'}
        />
        <span className="block min-w-0">
          <span className="type-eyebrow block">{slotLabel[slot]}</span>
          <span className="mt-1 block truncate text-base text-ink">
            {chosen?.name ?? emptyLabel}
          </span>
          <span className="mt-1 flex items-center gap-2">
            {chosen === undefined ? null : <Swatches colors={chosen.colors} />}
            <span className="text-ink-faint text-xs underline decoration-rule-strong underline-offset-4 group-hover:decoration-ink">
              Change
            </span>
          </span>
        </span>
      </button>
      {open ? (
        <GarmentPicker
          empty={{
            label: emptyLabel,
            onPick: () => {
              onChange('');
              setOpen(false);
            },
          }}
          eyebrow={formatLongDate(day)}
          groups={[{ garments: candidates }]}
          nothingFits="Nothing in the wardrobe fits this slot."
          onClose={() => setOpen(false)}
          onPick={(garment) => {
            onChange(garment.id);
            setOpen(false);
          }}
          selectedId={chosen?.id}
          title={slotLabel[slot]}
        />
      ) : null}
    </li>
  );
};
