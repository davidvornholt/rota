import { colorName } from '#/shared/data/color-name.ts';
import type { GarmentColor } from '#/shared/data/garment-types.ts';

type SwatchesProps = {
  readonly colors: ReadonlyArray<GarmentColor>;
  readonly size?: 'sm' | 'md';
};

const swatchSize = { sm: 12, md: 20 } as const;
const swatchGap = 4;

/** The garment's colours as square chips, dominant first, drawn as one small SVG. */
export const Swatches = ({ colors, size = 'sm' }: SwatchesProps) => {
  if (colors.length === 0) {
    return null;
  }
  const side = swatchSize[size];
  const width = colors.length * side + (colors.length - 1) * swatchGap;
  return (
    <svg
      aria-label={`Colours: ${colors.map((color) => colorName(color.hex)).join(', ')}`}
      className="inline-block shrink-0"
      height={side}
      role="img"
      viewBox={`0 0 ${width} ${side}`}
      width={width}
    >
      {colors.map((color, index) => (
        <rect
          fill={color.hex}
          height={side}
          key={`${color.hex}-${colorName(color.hex)}`}
          stroke="var(--color-rule)"
          width={side}
          x={index * (side + swatchGap)}
          y={0}
        />
      ))}
    </svg>
  );
};
