import { useId } from 'react';
import {
  formalityOptions,
  warmthOptions,
} from '#/shared/data/garment-scales.ts';
import {
  categoryDefaults,
  type GarmentCategory,
  garmentCategories,
  longestWearBudget,
  type Slot,
  seasons,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { checkClass, fieldClass, labelClass } from '#/shared/ui/classes.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { ColourFields } from './colour-fields.tsx';
import { NumberField, Scale, TextField } from './form-fields.tsx';
import { toggled } from './garment-edit.ts';

type FieldsProps = {
  readonly value: GarmentEdit;
  readonly set: <K extends keyof GarmentEdit>(
    key: K,
    next: GarmentEdit[K],
  ) => void;
};

const IdentityFields = ({
  value,
  set,
  onCategory,
}: FieldsProps & {
  readonly onCategory: (category: GarmentCategory) => void;
}) => {
  const nameId = useId();
  const categoryId = useId();
  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
      <div>
        <label className={labelClass} htmlFor={nameId}>
          Name
        </label>
        <input
          className={[fieldClass, 'type-display mt-2 text-2xl'].join(' ')}
          id={nameId}
          maxLength={80}
          onChange={(event) => set('name', event.target.value)}
          required={true}
          type="text"
          value={value.name}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={categoryId}>
          Category
        </label>
        <select
          className={[fieldClass, 'mt-2'].join(' ')}
          id={categoryId}
          onChange={(event) =>
            onCategory(event.target.value as GarmentCategory)
          }
          value={value.category}
        >
          {garmentCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const SlotFields = ({ value, set }: FieldsProps) => (
  <fieldset>
    <legend className={labelClass}>Worn as</legend>
    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
      {slotOrder.map((slot: Slot) => (
        <label
          className="inline-flex min-h-11 items-center gap-2 text-ink text-sm"
          key={slot}
        >
          <input
            checked={value.slots.includes(slot)}
            className={checkClass}
            onChange={() => set('slots', toggled(value.slots, slot))}
            type="checkbox"
          />
          {slotLabel[slot]}
        </label>
      ))}
    </div>
  </fieldset>
);

const RotationFields = ({
  value,
  set,
  categoryBudget,
}: FieldsProps & { readonly categoryBudget: number }) => (
  <div className="grid gap-6 sm:grid-cols-2">
    <div>
      <NumberField
        inputMode="numeric"
        label="Days in a row"
        max={longestWearBudget}
        min={1}
        onChange={(next) => set('wearBudget', next)}
        placeholder={`Category default: ${categoryBudget}`}
        value={value.wearBudget}
      />
      <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-ink text-sm">
        <input
          checked={value.rainOk}
          className={checkClass}
          onChange={(event) => set('rainOk', event.target.checked)}
          type="checkbox"
        />
        Fine in rain
      </label>
    </div>
    <fieldset>
      <legend className={labelClass}>Seasons</legend>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {seasons.map((season) => (
          <label
            className="inline-flex min-h-11 items-center gap-2 text-ink text-sm"
            key={season}
          >
            <input
              checked={value.seasons.includes(season)}
              className={checkClass}
              onChange={() => set('seasons', toggled(value.seasons, season))}
              type="checkbox"
            />
            {season}
          </label>
        ))}
      </div>
    </fieldset>
  </div>
);

const DetailFields = ({ value, set }: FieldsProps) => {
  const notesId = useId();
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField
          label="Fit"
          onChange={(next) => set('fit', next)}
          value={value.fit}
        />
        <TextField
          label="Sleeve"
          onChange={(next) => set('sleeve', next)}
          value={value.sleeve}
        />
        <TextField
          label="Brand"
          onChange={(next) => set('brand', next)}
          value={value.brand}
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <NumberField
          inputMode="decimal"
          label="Price"
          min={0}
          onChange={(next) => set('price', next)}
          placeholder="Optional"
          step="0.01"
          value={value.price}
        />
        <TextField
          label="Bought on"
          onChange={(next) =>
            set('purchasedOn', next === '' ? null : localDate(next))
          }
          type="date"
          value={value.purchasedOn ?? ''}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={notesId}>
          Notes
        </label>
        <textarea
          className={[fieldClass, 'mt-2 min-h-24'].join(' ')}
          id={notesId}
          maxLength={2000}
          onChange={(event) => set('notes', event.target.value)}
          value={value.notes}
        />
      </div>
    </>
  );
};

type GarmentFormProps = {
  readonly value: GarmentEdit;
  readonly onChange: (value: GarmentEdit) => void;
  readonly categoryBudget: number;
  /** The review card shows the fields that decide; the detail page shows all. */
  readonly compact?: boolean;
};

/** Every editable field of a garment; the review card and the detail page share it. */
export const GarmentForm = ({
  value,
  onChange,
  categoryBudget,
  compact = false,
}: GarmentFormProps) => {
  const set = <K extends keyof GarmentEdit>(key: K, next: GarmentEdit[K]) =>
    onChange({ ...value, [key]: next });
  const onCategory = (category: GarmentCategory) =>
    onChange({
      ...value,
      category,
      slots:
        value.slots.length === 0
          ? categoryDefaults[category].slots
          : value.slots,
    });

  return (
    <div className="grid gap-6">
      <IdentityFields onCategory={onCategory} set={set} value={value} />
      <SlotFields set={set} value={value} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Scale
          label="Warmth"
          onChange={(level) => set('warmth', level)}
          value={value.warmth}
          options={warmthOptions}
        />
        <Scale
          label="Formality"
          onChange={(level) => set('formality', level)}
          value={value.formality}
          options={formalityOptions}
        />
      </div>
      <RotationFields categoryBudget={categoryBudget} set={set} value={value} />
      <ColourFields
        colors={value.colors}
        onChange={(next) => set('colors', next)}
      />
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField
          label="Material"
          onChange={(next) => set('material', next)}
          value={value.material}
        />
        <TextField
          label="Pattern"
          onChange={(next) => set('pattern', next)}
          value={value.pattern}
        />
        <TextField
          label="Kind"
          onChange={(next) => set('subcategory', next)}
          placeholder="chinos, oxford shirt …"
          value={value.subcategory}
        />
      </div>
      {compact ? null : <DetailFields set={set} value={value} />}
    </div>
  );
};
