import { useQuery } from '@tanstack/react-query';
import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import type { AlternativesView } from '../services/today-actions.ts';

type SwapSheetProps = {
  readonly slot: Slot;
  readonly currentIds: ReadonlyArray<string>;
  readonly load: (
    slot: Slot,
    currentIds: ReadonlyArray<string>,
  ) => Promise<AlternativesView>;
  readonly onPick: (garment: GarmentView) => void;
  readonly onClose: () => void;
};

const rest = (garment: GarmentView): string =>
  garment.daysSinceWorn === null
    ? 'never worn'
    : `${garment.daysSinceWorn} day${garment.daysSinceWorn === 1 ? '' : 's'} ago`;

const Choice = ({
  garment,
  onPick,
}: {
  readonly garment: GarmentView;
  readonly onPick: (garment: GarmentView) => void;
}) => (
  <li className="w-28 shrink-0 snap-start sm:w-32">
    <button
      className="group block w-full text-left"
      onClick={() => onPick(garment)}
      type="button"
    >
      <GarmentFigure
        alt=""
        className="border border-transparent transition-colors group-hover:border-ink"
        colors={garment.colors}
        image={garment.image}
        name={garment.name}
      />
      <span className="mt-2 block text-ink text-sm leading-snug">
        {garment.name}
      </span>
      <span className="type-data block text-ink-faint text-xs">
        {rest(garment)}
      </span>
    </button>
  </li>
);

const Strip = ({
  heading,
  garments,
  onPick,
}: {
  readonly heading: string;
  readonly garments: ReadonlyArray<GarmentView>;
  readonly onPick: (garment: GarmentView) => void;
}) =>
  garments.length === 0 ? null : (
    <>
      <p className="text-ink-muted text-xs [&:not(:first-child)]:mt-5">
        {heading}
      </p>
      <ul className="mt-2 flex snap-x gap-4 overflow-x-auto pb-2">
        {garments.map((garment) => (
          <Choice garment={garment} key={garment.id} onPick={onPick} />
        ))}
      </ul>
    </>
  );

const Choices = ({
  view,
  onPick,
}: {
  readonly view: AlternativesView;
  readonly onPick: (garment: GarmentView) => void;
}) =>
  view.ranked.length === 0 && view.others.length === 0 ? (
    <p className="text-ink-muted text-sm">
      Nothing else in the wardrobe fits this slot. Add a garment for it from the
      wardrobe.
    </p>
  ) : (
    <>
      <Strip
        garments={view.ranked}
        heading="Suggested for today"
        onPick={onPick}
      />
      <Strip
        garments={view.others}
        heading="Everything else that fits the slot"
        onPick={onPick}
      />
    </>
  );

/**
 * The picker for one slot, opened as a dialog over the outfit: the engine's
 * ranked candidates first, then the rest of what could go there, each as a
 * strip you can thumb through. Picking closes it.
 */
export const SwapSheet = ({
  slot,
  currentIds,
  load,
  onPick,
  onClose,
}: SwapSheetProps) => {
  const alternatives = useQuery({
    queryKey: ['alternatives', slot, ...currentIds],
    queryFn: () => load(slot, currentIds),
  });

  return (
    <Dialog
      eyebrow="Swap"
      onClose={onClose}
      open={true}
      size="wide"
      title={`Another ${slotLabel[slot].toLowerCase()}`}
    >
      {alternatives.isPending ? (
        <p className="text-ink-muted text-sm" role="status">
          Looking through the wardrobe …
        </p>
      ) : null}
      {alternatives.isError ? (
        <Notice live={true}>
          The alternatives could not be loaded. Close this and try again.
        </Notice>
      ) : null}
      {alternatives.isSuccess ? (
        <Choices onPick={onPick} view={alternatives.data} />
      ) : null}
    </Dialog>
  );
};
