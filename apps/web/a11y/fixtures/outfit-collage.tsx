import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import {
  type CollageEntry,
  collageLabel,
} from '#/shared/collage/collage-entries.ts';
import type {
  GarmentImageView,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import { frameClass } from '#/shared/ui/classes.ts';
import { OutfitCollage } from '#/shared/ui/outfit-collage.tsx';
import { ShareOutfitButton } from '#/shared/ui/share-outfit-dialog.tsx';
import { failingGarmentId, makingGarmentId } from './collage-fns.ts';
import { shirt } from './today-proposal.ts';

/** `version` names another stored picture of the same drawing, so it makes another collage. */
const picture = (file: string, version = ''): GarmentImageView => ({
  url: `/a11y/fixtures/${file}${version}`,
  srcSet: `/a11y/fixtures/${file}${version} 300w`,
  width: 300,
  height: 400,
  fit: 'contain',
});

const oxford: GarmentView = { ...shirt, image: picture('shirt.svg') };
const chinos: GarmentView = {
  ...shirt,
  id: 'collage-chinos',
  name: 'Sand chinos',
  category: 'trousers',
  slots: ['bottom'],
  colors: [{ hex: '#b59a6a' }],
  image: picture('trousers.svg'),
};
const jumper: GarmentView = {
  ...shirt,
  id: 'collage-jumper',
  name: 'Green knit jumper',
  category: 'jumper',
  slots: ['over'],
  colors: [{ hex: '#2f4a3a' }],
  image: picture('knit.svg'),
};
const making: GarmentView = {
  ...oxford,
  id: makingGarmentId,
  name: 'White Oxford shirt',
  image: picture('shirt.svg', '?white'),
};
const failing: GarmentView = {
  ...jumper,
  id: failingGarmentId,
  name: 'Forest knit jumper',
  image: picture('knit.svg', '?forest'),
};
const unpictured: GarmentView = {
  ...shirt,
  id: 'collage-unpictured',
  name: 'Grey tee',
  colors: [{ hex: '#8a8a8a' }],
};

const outfits: ReadonlyArray<{
  readonly name: string;
  readonly entries: ReadonlyArray<CollageEntry>;
}> = [
  {
    name: 'Weekend',
    entries: [
      { slot: 'over', garment: jumper },
      { slot: 'top', garment: oxford },
      { slot: 'bottom', garment: chinos },
    ],
  },
  {
    name: 'Office',
    entries: [
      { slot: 'top', garment: making },
      { slot: 'bottom', garment: chinos },
    ],
  },
  {
    name: 'Rainy day',
    entries: [
      { slot: 'top', garment: oxford },
      { slot: 'over', garment: failing },
      { slot: 'bottom', garment: chinos },
    ],
  },
  {
    name: 'Pared back',
    entries: [
      { slot: 'top', garment: unpictured },
      { slot: 'bottom', garment: chinos },
      { slot: 'shoes', garment: undefined },
    ],
  },
  {
    name: 'Unpictured',
    entries: [{ slot: 'top', garment: unpictured }],
  },
];

const queryClient = new QueryClient();

const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
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
      </main>
    </QueryClientProvider>,
  );
}
