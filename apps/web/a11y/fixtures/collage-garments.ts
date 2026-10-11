import type {
  ContentFraction,
  GarmentView,
} from '#/shared/data/garment-view.ts';
import { shirt } from './today-proposal.ts';

const renderWidth = 1200;
const renderHeight = 1600;

/** The garment's box in a synthetic render, as the measurement would store it. */
const content = (
  left: number,
  top: number,
  width: number,
  height: number,
): ContentFraction => ({
  left: left / renderWidth,
  top: top / renderHeight,
  width: width / renderWidth,
  height: height / renderHeight,
});

const studio = (file: string, box: ContentFraction | null) => ({
  url: `/a11y/fixtures/${file}`,
  srcSet: `/a11y/fixtures/${file} 1200w`,
  width: renderWidth,
  height: renderHeight,
  fit: 'contain' as const,
  content: box,
});

const garment = (
  id: string,
  name: string,
  hex: string,
  image: GarmentView['image'],
): GarmentView => ({
  ...shirt,
  id,
  name,
  colors: [{ hex }],
  imageChoice: image?.fit === 'cover' ? 'original' : 'studio',
  image,
});

export const tee = garment(
  'collage-tee',
  'White tee',
  '#f4f2ee',
  studio('collage-tee.svg', content(147, 377, 906, 846)),
);
export const cardigan = garment(
  'collage-cardigan',
  'Grey cardigan',
  '#9b9a98',
  studio('collage-cardigan.svg', content(120, 260, 960, 1140)),
);
export const trousers = garment(
  'collage-trousers',
  'Navy pinstripe trousers',
  '#24364b',
  studio('collage-trousers.svg', content(280, 40, 640, 1520)),
);
export const loafers = garment(
  'collage-loafers',
  'Black loafers',
  '#1d1d1f',
  studio('collage-loafers.svg', content(138, 430, 964, 530)),
);
export const bag = garment(
  'collage-bag',
  'Tan bag',
  '#b07a4a',
  studio('collage-bag.svg', content(250, 380, 700, 870)),
);
/** A render the backfill has not measured yet: placed whole, margins included. */
export const unmeasuredTee = garment(
  'collage-unmeasured-tee',
  'Unmeasured tee',
  '#f4f2ee',
  studio('collage-tee.svg', null),
);
/** A phone photo the collage cannot cut out. */
export const photoShirt = garment(
  'collage-photo-shirt',
  'Blue Oxford shirt',
  '#536e8a',
  {
    url: '/a11y/fixtures/shirt.svg',
    srcSet: '/a11y/fixtures/shirt.svg 300w',
    width: 300,
    height: 400,
    fit: 'cover',
    content: null,
  },
);
/** A garment with no picture at all, shown as its colour. */
export const unpictured = garment(
  'collage-unpictured',
  'Olive chinos',
  '#6b6b3a',
  undefined,
);
