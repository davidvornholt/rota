import { useId } from 'react';

import type { GarmentScaleOption } from '#/shared/data/garment-scales.ts';
import { fieldClass, labelClass } from '#/shared/ui/classes.ts';

type ScaleProps = {
  readonly label: string;
  readonly value: number;
  readonly options: ReadonlyArray<GarmentScaleOption>;
  readonly onChange: (value: number) => void;
};

export const Scale = ({ label, value, options, onChange }: ScaleProps) => {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <fieldset aria-describedby={descriptionId}>
      <legend className={labelClass}>{label}</legend>
      <div className="mt-2 grid grid-cols-3 border border-rule-strong">
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <label
              className={[
                'relative flex h-14 cursor-pointer items-center justify-center border-rule-strong px-2 text-center text-sm leading-tight has-focus-visible:z-10 has-focus-visible:outline-2 has-focus-visible:outline-ink has-focus-visible:outline-offset-2',
                index > 0 ? 'border-l' : '',
                checked ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
              key={option.value}
            >
              <input
                aria-describedby={descriptionId}
                checked={checked}
                className="sr-only"
                name={id}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-ink-muted text-sm" id={descriptionId}>
        {options.find((option) => option.value === value)?.description}
      </p>
    </fieldset>
  );
};

type TextFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'date';
  readonly placeholder?: string;
};

export const TextField = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: TextFieldProps) => {
  const id = useId();
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        className={[fieldClass, 'mt-2'].join(' ')}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </div>
  );
};

type NumberFieldProps = {
  readonly label: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly min: number;
  readonly max?: number;
  readonly step?: string;
  readonly placeholder?: string;
  readonly inputMode: 'numeric' | 'decimal';
};

/** A number that may be left blank; blank reads back as null. */
export const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  inputMode,
}: NumberFieldProps) => {
  const id = useId();
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        className={[fieldClass, 'type-data mt-2'].join(' ')}
        id={id}
        inputMode={inputMode}
        max={max}
        min={min}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : Number(event.target.value),
          )
        }
        placeholder={placeholder}
        step={step}
        type="number"
        value={value ?? ''}
      />
    </div>
  );
};
