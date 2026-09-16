import type { ReactNode } from 'react';

import type { GarmentView } from '#/shared/data/garment-view.ts';
import { Dialog } from './dialog.tsx';
import { GarmentFigure } from './garment-figure.tsx';
import { Swatches } from './swatches.tsx';

/** A run of garments under one heading; the heading is left out when there is only one run. */
export type GarmentPickerGroup = {
  readonly heading?: string;
  readonly garments: ReadonlyArray<GarmentView>;
};

type GarmentPickerProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly groups: ReadonlyArray<GarmentPickerGroup>;
  /** The garment in the slot right now; drawn as chosen. */
  readonly selectedId?: string;
  /** The choice of nothing, offered first: "None" for an optional slot, "Not logged" for a required one. */
  readonly empty?: { readonly label: string; readonly onPick: () => void };
  /** What to say when no group has a garment. */
  readonly nothingFits: string;
  /** Shown above the choices while they load or when loading failed. */
  readonly notice?: ReactNode;
  readonly onPick: (garment: GarmentView) => void;
  readonly onClose: () => void;
};

const rest = (garment: GarmentView): string => {
  if (garment.status === 'retired') {
    return 'retired';
  }
  return garment.daysSinceWorn === null
    ? 'never worn'
    : `${garment.daysSinceWorn} day${garment.daysSinceWorn === 1 ? '' : 's'} ago`;
};

const tileClass = 'group block w-full text-left';
const frameClass = 'border transition-colors group-hover:border-ink';

const Tile = ({
  garment,
  selected,
  onPick,
}: {
  readonly garment: GarmentView;
  readonly selected: boolean;
  readonly onPick: (garment: GarmentView) => void;
}) => (
  <li>
    <button
      aria-current={selected ? 'true' : undefined}
      className={tileClass}
      onClick={() => onPick(garment)}
      type="button"
    >
      <GarmentFigure
        alt=""
        className={[
          frameClass,
          selected ? 'border-ink' : 'border-transparent',
        ].join(' ')}
        colors={garment.colors}
        image={garment.image}
        name={garment.name}
      />
      <span className="mt-2 block text-ink text-sm leading-snug">
        {garment.name}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <Swatches colors={garment.colors} />
        <span className="type-data text-ink-faint text-xs">
          {selected ? 'chosen' : rest(garment)}
        </span>
      </span>
    </button>
  </li>
);

const EmptyTile = ({
  label,
  selected,
  onPick,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPick: () => void;
}) => (
  <li>
    <button
      aria-current={selected ? 'true' : undefined}
      className={tileClass}
      onClick={onPick}
      type="button"
    >
      <span
        className={[
          'garment-frame flex items-center justify-center border-dashed',
          frameClass,
          selected ? 'border-ink' : 'border-rule-strong',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className="type-display text-4xl text-ink-faint"
        >
          ·
        </span>
      </span>
      <span className="mt-2 block text-ink text-sm leading-snug">{label}</span>
      {selected ? (
        <span className="type-data mt-1 block text-ink-faint text-xs">
          chosen
        </span>
      ) : null}
    </button>
  </li>
);

const gridClass = 'grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5';

/**
 * The one way to choose a garment: a dialog of pictures, name and colours
 * under each, for everything that could go in the slot. Used to swap a slot
 * of today's proposal and to fill a slot of a past day; picking closes it.
 */
export const GarmentPicker = ({
  eyebrow,
  title,
  groups,
  selectedId,
  empty,
  nothingFits,
  notice,
  onPick,
  onClose,
}: GarmentPickerProps) => {
  const shown = groups.filter((group) => group.garments.length > 0);
  const nothing = shown.length === 0;
  const emptyTile =
    empty === undefined ? null : (
      <EmptyTile
        label={empty.label}
        onPick={empty.onPick}
        selected={selectedId === undefined}
      />
    );
  return (
    <Dialog
      eyebrow={eyebrow}
      onClose={onClose}
      open={true}
      size="wide"
      title={title}
    >
      {notice}
      {nothing && notice === undefined ? (
        <p className="text-ink-muted text-sm">{nothingFits}</p>
      ) : null}
      {nothing && emptyTile !== null ? (
        <ul className={['mt-4', gridClass].join(' ')}>{emptyTile}</ul>
      ) : null}
      {shown.map((group, index) => (
        <div
          className="[&:not(:first-child)]:mt-6"
          key={group.heading ?? index}
        >
          {group.heading === undefined ? null : (
            <p className="text-ink-muted text-xs">{group.heading}</p>
          )}
          <ul className={['mt-2', gridClass].join(' ')}>
            {index === 0 ? emptyTile : null}
            {group.garments.map((garment) => (
              <Tile
                garment={garment}
                key={garment.id}
                onPick={onPick}
                selected={garment.id === selectedId}
              />
            ))}
          </ul>
        </div>
      ))}
    </Dialog>
  );
};
