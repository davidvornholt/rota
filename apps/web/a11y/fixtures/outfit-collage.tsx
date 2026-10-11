import { createRoot } from 'react-dom/client';
import {
  type CollageEntry,
  collageLabel,
} from '#/shared/collage/collage-pieces.ts';
import { frameClass } from '#/shared/ui/classes.ts';
import { OutfitCollage } from '#/shared/ui/outfit-collage.tsx';
import { ShareOutfitButton } from '#/shared/ui/share-outfit-dialog.tsx';
import {
  bag,
  cardigan,
  loafers,
  photoShirt,
  tee,
  trousers,
  unmeasuredTee,
  unpictured,
} from './collage-garments.ts';

const outfits: ReadonlyArray<{
  readonly name: string;
  readonly entries: ReadonlyArray<CollageEntry>;
}> = [
  {
    name: 'Layered',
    entries: [
      { slot: 'bottom', garment: trousers },
      { slot: 'top', garment: tee },
      { slot: 'over', garment: cardigan },
      { slot: 'shoes', garment: loafers },
      { slot: 'bag', garment: bag },
    ],
  },
  {
    name: 'Single layer',
    entries: [
      { slot: 'bottom', garment: trousers },
      { slot: 'top', garment: tee },
      { slot: 'shoes', garment: loafers },
    ],
  },
  {
    name: 'Top and bottom',
    entries: [
      { slot: 'bottom', garment: trousers },
      { slot: 'top', garment: tee },
    ],
  },
  {
    name: 'Fallbacks',
    entries: [
      { slot: 'bottom', garment: unpictured },
      { slot: 'top', garment: photoShirt },
      { slot: 'over', garment: cardigan },
      { slot: 'shoes', garment: undefined },
    ],
  },
  {
    name: 'Unmeasured',
    entries: [
      { slot: 'bottom', garment: trousers },
      { slot: 'top', garment: unmeasuredTee },
      { slot: 'bag', garment: bag },
    ],
  },
];

const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <main className={[frameClass, 'py-8'].join(' ')}>
      <h1 className="type-display text-4xl">Outfit collages</h1>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {outfits.map((outfit) => (
          <li key={outfit.name}>
            <OutfitCollage
              entries={outfit.entries}
              label={collageLabel(outfit.name, outfit.entries)}
              width="min(100vw - 2.5rem, 21rem)"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <h2 className="type-display text-2xl">{outfit.name}</h2>
              <ShareOutfitButton
                entries={outfit.entries}
                label={`Share ${outfit.name} as picture`}
                title={outfit.name}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>,
  );
}
