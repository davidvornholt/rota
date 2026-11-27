import { fieldClass } from '#/shared/ui/classes.ts';
import { longestStyleNote } from '../schemas/settings-input.ts';

export const StyleSetting = ({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  // The wrapper sets the width in the body size, so the field lines up with the
  // number fields below it, whose row is also max-w-prose.
  <div className="max-w-prose">
    <label className="block text-sm">
      Your style (optional)
      <textarea
        className={[fieldClass, 'mt-2'].join(' ')}
        maxLength={longestStyleNote}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Smart casual most days. Blazer only for occasions."
        rows={3}
        value={value}
      />
      <span className="mt-2 block text-ink-muted text-xs">
        Every morning suggestion follows this. A day's own plans come first.
      </span>
    </label>
  </div>
);
