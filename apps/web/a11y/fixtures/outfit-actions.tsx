import { useState } from 'react';
import { OutfitEditor } from '#/features/rota/ui/outfit-editor.tsx';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
export const OutfitActionsFixture = ({
  garment,
  continuing = false,
}: {
  readonly garment: GarmentView;
  readonly continuing?: boolean;
}) => {
  const [entries, setEntries] = useState<ReadonlyArray<OutfitEntry>>([
    { slot: 'over', garmentId: garment.id },
    ...(continuing
      ? [{ slot: 'bottom' as const, garmentId: 'demo-chinos' }]
      : []),
  ]);
  const wardrobe = [
    { ...garment, slots: ['over'] as const },
    {
      ...garment,
      id: 'demo-chinos',
      slots: ['bottom'] as const,
      name: 'Navy chinos',
    },
    {
      ...garment,
      id: 'demo-jacket',
      slots: ['over'] as const,
      name: 'Wax jacket',
      daysSinceWorn: 9,
    },
    {
      ...garment,
      id: 'demo-cardigan',
      slots: ['over'] as const,
      name: 'Grey cardigan',
      daysSinceWorn: null,
    },
  ];
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl">Today</h1>
      <OutfitEditor
        entries={entries}
        onChange={setEntries}
        wardrobe={wardrobe}
        pinned={[]}
        onPin={null}
        disabled={false}
        readOnly={false}
        laundryDisabled={false}
        onLaundry={null}
      />
    </div>
  );
};
