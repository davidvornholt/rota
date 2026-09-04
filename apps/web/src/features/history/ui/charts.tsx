import { Link } from '@tanstack/react-router';

import type { GarmentView } from '#/shared/data/garment-view.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import type { ColorShare, TemperatureRow } from '../stats.ts';

/** A number set large in the serif with what it counts beneath it. */
export const Stat = ({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) => (
  <div className="border-rule border-t py-4">
    <p className="type-display type-data text-4xl text-ink sm:text-5xl">
      {value}
    </p>
    <p className="type-eyebrow mt-1">{label}</p>
  </div>
);

const axisMin = -5;
const axisMax = 35;
const axisMid = 15;
const stripWidth = 100;
const stripHeight = 10;
const wearMarkSide = 3;
const medianMarkWidth = 1;
const clamp = (value: number) => Math.min(axisMax, Math.max(axisMin, value));
const xOf = (value: number) =>
  ((clamp(value) - axisMin) / (axisMax - axisMin)) * stripWidth;

/** One mark per wear; equal highs get a running count so each mark keeps its own key. */
const marksOf = (highs: ReadonlyArray<number>) => {
  const seen = new Map<number, number>();
  return highs.map((high) => {
    const occurrence = (seen.get(high) ?? 0) + 1;
    seen.set(high, occurrence);
    return { high, key: `${high}-${occurrence}` };
  });
};

const TemperatureStrip = ({ row }: { readonly row: TemperatureRow }) => (
  <svg
    className="h-6 w-full"
    preserveAspectRatio="none"
    role="img"
    viewBox={`0 0 ${stripWidth} ${stripHeight}`}
  >
    <title>
      {`${row.garment.name}: worn between ${Math.round(row.lowest)}° and ${Math.round(row.highest)}°, usually around ${Math.round(row.median)}°`}
    </title>
    <line
      stroke="var(--color-rule)"
      strokeWidth={0.4}
      x1={0}
      x2={stripWidth}
      y1={stripHeight / 2}
      y2={stripHeight / 2}
    />
    {marksOf(row.highs).map((mark) => (
      <rect
        fill="var(--color-ink-faint)"
        height={wearMarkSide}
        key={mark.key}
        width={wearMarkSide}
        x={xOf(mark.high) - wearMarkSide / 2}
        y={(stripHeight - wearMarkSide) / 2}
      />
    ))}
    <rect
      fill="var(--color-ink)"
      height={stripHeight}
      width={medianMarkWidth}
      x={xOf(row.median) - medianMarkWidth / 2}
      y={0}
    />
  </svg>
);

/**
 * Where each garment actually gets worn on the thermometer: one square per
 * wear at that day's high, the median as a taller mark. Sorted cold to hot.
 */
export const TemperatureStrips = ({
  rows,
}: {
  readonly rows: ReadonlyArray<TemperatureRow>;
}) => {
  if (rows.length === 0) {
    return (
      <p className="mt-4 max-w-prose text-ink-muted">
        Once a garment has been worn on three forecast days its temperatures
        show here.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <div className="type-data ml-0 flex justify-between text-[10px] text-ink-faint sm:ml-44">
        <span>{axisMin}°</span>
        <span>{axisMid}°</span>
        <span>{axisMax}°</span>
      </div>
      <ul className="border-rule border-t">
        {rows.map((row) => (
          <li
            className="grid items-center gap-2 border-rule border-b py-2 sm:grid-cols-[11rem_1fr]"
            key={row.garment.id}
          >
            <Link
              className="truncate text-ink text-sm hover:underline"
              params={{ garmentId: row.garment.id }}
              to="/wardrobe/$garmentId"
            >
              {row.garment.name}
            </Link>
            <TemperatureStrip row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
};

const percentScale = 100;
const barHeight = 8;

const Bar = ({
  label,
  shares,
}: {
  readonly label: string;
  readonly shares: ReadonlyArray<ColorShare>;
}) => {
  let offset = 0;
  const segments = shares.map((share) => {
    const segment = { ...share, x: offset, width: share.share * percentScale };
    offset += segment.width;
    return segment;
  });
  return (
    <div>
      <p className="type-eyebrow">{label}</p>
      <svg
        className="mt-2 h-8 w-full border border-rule"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${percentScale} ${barHeight}`}
      >
        <title>
          {`${label}: ${shares.map((share) => `${share.name} ${Math.round(share.share * percentScale)}%`).join(', ')}`}
        </title>
        {segments.map((segment) => (
          <rect
            fill={segment.hex}
            height={barHeight}
            key={segment.name}
            width={segment.width}
            x={segment.x}
            y={0}
          />
        ))}
      </svg>
    </div>
  );
};

/** Two bars: the colours you own, and the colours you actually put on. */
export const ColorBars = ({
  owned,
  worn,
}: {
  readonly owned: ReadonlyArray<ColorShare>;
  readonly worn: ReadonlyArray<ColorShare>;
}) => {
  if (owned.length === 0) {
    return (
      <p className="mt-4 max-w-prose text-ink-muted">
        Colours appear once the wardrobe has garments.
      </p>
    );
  }
  return (
    <div className="mt-4 grid gap-4">
      <Bar label="Owned" shares={owned} />
      {worn.length === 0 ? (
        <p className="text-ink-muted text-sm">Nothing worn yet.</p>
      ) : (
        <Bar label="Worn" shares={worn} />
      )}
    </div>
  );
};

/** A small row of garments with one fact each; used for most worn, neglected, cost per wear. */
export const GarmentStrip = ({
  garments,
  fact,
  empty,
}: {
  readonly garments: ReadonlyArray<GarmentView>;
  readonly fact: (garment: GarmentView) => string;
  readonly empty: string;
}) => {
  if (garments.length === 0) {
    return <p className="mt-4 max-w-prose text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {garments.map((garment) => (
        <li key={garment.id}>
          <Link
            className="group block"
            params={{ garmentId: garment.id }}
            to="/wardrobe/$garmentId"
          >
            <GarmentFigure
              alt=""
              className="border border-transparent group-hover:border-ink"
              colors={garment.colors}
              image={garment.image}
              name={garment.name}
            />
            <span className="mt-1 block truncate text-ink text-xs">
              {garment.name}
            </span>
            <span className="type-data block text-ink-faint text-xs">
              {fact(garment)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
