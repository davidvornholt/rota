import { useQuery } from '@tanstack/react-query';
import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { GarmentPicker } from '#/shared/ui/garment-picker.tsx';
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

const notice = (alternatives: { isPending: boolean; isError: boolean }) => {
  if (alternatives.isPending) {
    return (
      <p className="text-ink-muted text-sm" role="status">
        Looking through the wardrobe …
      </p>
    );
  }
  if (alternatives.isError) {
    return (
      <Notice live={true}>
        The alternatives could not be loaded. Close this and try again.
      </Notice>
    );
  }
};

/**
 * The picker for one slot of today's outfit: the engine's ranked candidates
 * first, then the rest of what could go there.
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
    <GarmentPicker
      eyebrow="Swap"
      groups={
        alternatives.data === undefined
          ? []
          : [
              {
                heading: 'Suggested for today',
                garments: alternatives.data.ranked,
              },
              {
                heading: 'Everything else that fits the slot',
                garments: alternatives.data.others,
              },
            ]
      }
      nothingFits="Nothing else in the wardrobe fits this slot. Add a garment for it from the wardrobe."
      notice={notice(alternatives)}
      onClose={onClose}
      onPick={onPick}
      title={`Another ${slotLabel[slot].toLowerCase()}`}
    />
  );
};
