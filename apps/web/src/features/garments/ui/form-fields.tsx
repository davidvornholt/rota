import { useId } from 'react';

import { fieldClass, labelClass } from '#/shared/ui/classes.ts';

type ScaleProps = {
  readonly label: string;
  readonly value: number;
  readonly words: ReadonlyArray<string>;
  readonly onChange: (value: number) => void;
};

/** A five-step scale as a row of squares; the chosen step is filled in ink. */
export const Scale = ({ label, value, words, onChange }: ScaleProps) => {
  const id = useId();
  return (
    <fieldset>
      <legend className={labelClass}>{label}</legend>
      <div
        className="mt-2 grid grid-cols-5 border border-rule-strong"
        role="radiogroup"
      >
        {words.map((word, index) => {
          const level = index + 1;
          const checked = level === value;
          return (
            <label
              className={[
                'flex min-h-11 cursor-pointer flex-col items-center justify-center border-rule-strong px-1 py-2 text-center text-xs leading-tight',
                index > 0 ? 'border-l' : '',
                checked ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
              key={word}
            >
              <input
                checked={checked}
                className="sr-only"
                name={id}
                onChange={() => onChange(level)}
                type="radio"
                value={level}
              />
              <span className="type-data">{level}</span>
              <span className="hidden sm:block">{word}</span>
            </label>
          );
        })}
      </div>
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
