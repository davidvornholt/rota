import { colorName } from '#/shared/data/color-name.ts';
import type { GarmentColor } from '#/shared/data/garment-types.ts';
import { labelClass, linkButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';

const mostColors = 5;
const newColorHex = '#808080';

type ColourFieldsProps = {
  readonly colors: ReadonlyArray<GarmentColor>;
  readonly onChange: (colors: ReadonlyArray<GarmentColor>) => void;
};

type Row = GarmentColor & { readonly position: number };

/** The garment's colours, dominant first: a picker and a derived name per row. */
export const ColourFields = ({ colors, onChange }: ColourFieldsProps) => {
  const rows: ReadonlyArray<Row> = colors.map((color, position) => ({
    ...color,
    position,
  }));
  const update = (position: number, patch: Partial<GarmentColor>) =>
    onChange(
      colors.map((entry, at) =>
        at === position ? { ...entry, ...patch } : entry,
      ),
    );
  return (
    <fieldset>
      <legend className={labelClass}>Colours</legend>
      {colors.length === 0 ? (
        <p className="mt-1 text-ink-muted text-sm">
          Choose at least one colour.
        </p>
      ) : null}
      <ul className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        {rows.map((row) => (
          <li className="flex items-center gap-3" key={row.position}>
            <input
              aria-label={`Colour ${row.position + 1}`}
              className="size-11 cursor-pointer border border-rule-strong bg-paper p-0.5"
              onChange={(event) =>
                update(row.position, { hex: event.target.value })
              }
              type="color"
              value={row.hex}
            />
            <output
              aria-label={`Colour ${row.position + 1} name`}
              className="text-sm"
            >
              {colorName(row.hex)}
            </output>
            <IconButton
              icon="close"
              label={`Remove colour ${row.position + 1}`}
              tooltip={
                colors.length === 1
                  ? 'Keep at least one colour'
                  : `Remove ${colorName(row.hex).toLowerCase()} colour`
              }
              disabled={colors.length === 1}
              onClick={() =>
                onChange(colors.filter((_, at) => at !== row.position))
              }
            />
          </li>
        ))}
        {colors.length < mostColors ? (
          <li>
            <button
              className={linkButtonClass}
              onClick={() => onChange([...colors, { hex: newColorHex }])}
              type="button"
            >
              Add a colour
            </button>
          </li>
        ) : null}
      </ul>
    </fieldset>
  );
};
