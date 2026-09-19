import { fieldClass } from '#/shared/ui/classes.ts';
export const LaundrySetting = ({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}) => (
  <label className="block max-w-sm text-sm">
    Laundry usually takes (days)
    <input
      className={[fieldClass, 'mt-2'].join(' ')}
      type="number"
      min={1}
      max={30}
      required={true}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <span className="mt-2 block text-ink-muted text-xs">
      After its final wear before washing, a piece returns clean automatically.
    </span>
  </label>
);
