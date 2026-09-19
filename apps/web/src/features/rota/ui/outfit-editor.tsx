import { useState } from 'react';
import {
  hasWearBudget,
  type Slot,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { checkClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { careLabel } from './care-label.ts';

type OutfitEditorProps = {
  readonly entries: ReadonlyArray<OutfitEntry>;
  readonly wardrobe: ReadonlyArray<GarmentView>;
  readonly onChange: (entries: ReadonlyArray<OutfitEntry>) => void;
  readonly pinned: ReadonlyArray<string>;
  readonly onPin: ((id: string) => void) | null;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly laundryDisabled: boolean;
  readonly onLaundry: ((id: string) => void) | null;
};

const OutfitPiece = ({
  slot,
  entries,
  wardrobe,
  disabled,
  readOnly,
  laundryDisabled,
  onLaundry,
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
                Keep when suggesting
              </label>
            )}
            <div className="ml-auto flex items-center">
              {onLaundry === null ||
              garment.inLaundry ||
              !hasWearBudget(garment) ? null : (
                <IconButton
                  icon="laundry"
                  label={`Send ${garment.name} to laundry`}
                  disabled={laundryDisabled}
                  onClick={() => onLaundry(garment.id)}
                />
              )}
              {readOnly ? null : (
                <IconButton
                  icon="close"
                  label={`Remove ${slotLabel[slot].toLowerCase()}`}
                  disabled={disabled}
                  onClick={() => onRemove(slot)}
                />
              )}
            </div>
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
  readOnly,
  laundryDisabled,
  onLaundry,
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
            readOnly={readOnly}
            laundryDisabled={laundryDisabled}
            onLaundry={onLaundry}
            pinned={pinned}
            onPin={onPin}
            onChoose={setChoosing}
            onRemove={remove}
          />
        ))}
      </div>
      {optional.length === 0 || readOnly ? null : (
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
              heading: 'In laundry',
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
