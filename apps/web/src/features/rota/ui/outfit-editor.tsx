import { useState } from 'react';
import {
  hasWearBudget,
  type Slot,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import {
  checkClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { careLabel } from './care-label.ts';

type OutfitEditorProps = {
  readonly entries: ReadonlyArray<OutfitEntry>;
  readonly wardrobe: ReadonlyArray<GarmentView>;
  readonly onChange: (entries: ReadonlyArray<OutfitEntry>) => void;
  readonly pinned: ReadonlyArray<string>;
  readonly onPin: ((id: string) => void) | null;
  readonly disabled: boolean;
};

const OutfitPiece = ({
  slot,
  entries,
  wardrobe,
  disabled,
  pinned,
  onPin,
  onChoose,
  onRemove,
}: Omit<OutfitEditorProps, 'onChange'> & {
  readonly slot: Slot;
  readonly onChoose: (slot: Slot) => void;
  readonly onRemove: (slot: Slot) => void;
}) => {
  const entry = entries.find((piece) => piece.slot === slot);
  const garment = wardrobe.find((piece) => piece.id === entry?.garmentId);
  return (
    <section aria-label={slotLabel[slot]} key={slot}>
      <p className="type-eyebrow mb-2">{slotLabel[slot]}</p>
      <button
        className="group block w-full text-left"
        disabled={disabled}
        onClick={() => onChoose(slot)}
        type="button"
        aria-label={
          garment === undefined
            ? `Choose ${slotLabel[slot].toLowerCase()}`
            : `Change ${garment.name}`
        }
      >
        {garment === undefined ? (
          <span className="garment-frame flex items-center justify-center border border-rule-strong border-dashed text-ink-muted text-sm">
            {entry === undefined ? 'Choose a piece' : 'Choose a replacement'}
          </span>
        ) : (
          <GarmentFigure
            alt=""
            colors={garment.colors}
            image={garment.image}
            name={garment.name}
          />
        )}
        <span className="type-display mt-2 block text-ink text-xl sm:text-2xl">
          {garment?.name ??
            (entry === undefined
              ? `Add ${slotLabel[slot].toLowerCase()}`
              : 'Piece unavailable')}
        </span>
      </button>
      {garment === undefined ? null : (
        <>
          <p className="mt-1 text-ink-muted text-xs">{careLabel(garment)}</p>
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            {onPin === null ? null : (
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  className={checkClass}
                  type="checkbox"
                  checked={pinned.includes(garment.id)}
                  disabled={disabled}
                  onChange={() => onPin(garment.id)}
                />
                Keep
              </label>
            )}
            <button
              aria-label={`Remove ${slotLabel[slot].toLowerCase()}`}
              className={linkButtonClass}
              disabled={disabled}
              onClick={() => onRemove(slot)}
              type="button"
            >
              Remove
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export const OutfitEditor = ({
  entries,
  wardrobe,
  onChange,
  pinned,
  onPin,
  disabled,
}: OutfitEditorProps) => {
  const [choosing, setChoosing] = useState<Slot | null>(null);
  const shown = slotOrder.filter(
    (slot) =>
      slot === 'top' ||
      slot === 'bottom' ||
      entries.some((entry) => entry.slot === slot),
  );
  const optional = slotOrder.filter(
    (slot) =>
      !shown.includes(slot) &&
      wardrobe.some((garment) => garment.slots.includes(slot)),
  );
  const remove = (slot: Slot) =>
    onChange(entries.filter((entry) => entry.slot !== slot));
  const choose = (slot: Slot, garment: GarmentView) => {
    onChange([
      ...entries.filter(
        (entry) => entry.slot !== slot && entry.garmentId !== garment.id,
      ),
      { slot, garmentId: garment.id },
    ]);
    if (onPin !== null && !pinned.includes(garment.id)) {
      onPin(garment.id);
    }
    setChoosing(null);
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6">
        {shown.map((slot) => (
          <OutfitPiece
            key={slot}
            slot={slot}
            entries={entries}
            wardrobe={wardrobe}
            disabled={disabled}
            pinned={pinned}
            onPin={onPin}
            onChoose={setChoosing}
            onRemove={remove}
          />
        ))}
      </div>
      {optional.length === 0 ? null : (
        <div className="mt-5 flex flex-wrap gap-2">
          {optional.map((slot) => (
            <button
              className={quietButtonClass}
              disabled={disabled}
              key={slot}
              onClick={() => setChoosing(slot)}
              type="button"
            >
              Add {slotLabel[slot].toLowerCase()}
            </button>
          ))}
        </div>
      )}
      {choosing === null ? null : (
        <GarmentPicker
          eyebrow="Your wardrobe"
          title={`Choose ${slotLabel[choosing].toLowerCase()}`}
          groups={[
            {
              heading: 'Ready to wear',
              garments: wardrobe.filter(
                (garment) =>
                  garment.slots.includes(choosing) &&
                  !garment.inLaundry &&
                  (!hasWearBudget(garment) ||
                    garment.wearsSinceWash < garment.effectiveBudget),
              ),
            },
            {
              heading: 'Wash before wearing',
              garments: wardrobe.filter(
                (garment) =>
                  garment.slots.includes(choosing) &&
                  (garment.inLaundry ||
                    (hasWearBudget(garment) &&
                      garment.wearsSinceWash >= garment.effectiveBudget)),
              ),
            },
          ]}
          selectedId={
            entries.find((entry) => entry.slot === choosing)?.garmentId
          }
          nothingFits="Add a piece to your wardrobe first."
          onPick={(garment) => choose(choosing, garment)}
          onClose={() => setChoosing(null)}
        />
      )}
    </>
  );
};
