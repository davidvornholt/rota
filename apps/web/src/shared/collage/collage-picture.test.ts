import { describe, expect, it } from 'bun:test';
import type { GarmentImageView } from '#/shared/data/garment-view.ts';
import { sourceFor } from './collage-picture.ts';

const image = (srcSet: string): GarmentImageView => ({
  url: '/media/original.png',
  srcSet,
  width: 1200,
  height: 1600,
  fit: 'contain',
  content: null,
});

describe('sourceFor', () => {
  const copies = image(
    '/media/w800.webp 800w, /media/w320.webp 320w, /media/w1200.webp 1200w',
  );

  it('takes the smallest copy at least as wide as the picture needs', () => {
    expect(sourceFor(copies, 300)).toBe('/media/w320.webp');
    expect(sourceFor(copies, 321)).toBe('/media/w800.webp');
    expect(sourceFor(copies, 800)).toBe('/media/w800.webp');
  });

  it('takes the widest copy when none is wide enough', () => {
    expect(sourceFor(copies, 2000)).toBe('/media/w1200.webp');
  });

  it('falls back to the original without usable copies', () => {
    expect(sourceFor(image(''), 300)).toBe('/media/original.png');
    expect(sourceFor(image('/media/w320.webp 2x'), 300)).toBe(
      '/media/original.png',
    );
  });
});
