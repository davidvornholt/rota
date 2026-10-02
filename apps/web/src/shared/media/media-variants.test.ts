import { describe, expect, it } from 'bun:test';
import {
  largeWidth,
  mediaSrcSet,
  mediaUrl,
  requestedVariant,
  smallWidth,
  tileWidth,
  variantKey,
} from './media-variants.ts';

const hashLength = 64;
const key = `${'a'.repeat(hashLength)}.png`;
const photoWidth = 1536;
const betweenSmallAndTile = 500;
const belowSmall = 300;
const request = (query: string) =>
  requestedVariant(new URL(`https://rota.test/api/media/${key}${query}`));
const shortUrl = (width: number) => `/m?w=${width}`;

describe('media variants', () => {
  it('addresses the original without a width and a copy with one', () => {
    expect(mediaUrl(key)).toBe(`/api/media/${key}`);
    expect(mediaUrl(key, tileWidth)).toBe(`/api/media/${key}?w=${tileWidth}`);
  });

  it.each([
    { query: '', expected: { kind: 'original' } },
    {
      query: `?w=${smallWidth}`,
      expected: { kind: 'variant', width: smallWidth },
    },
    {
      query: `?w=${largeWidth}`,
      expected: { kind: 'variant', width: largeWidth },
    },
    { query: `?w=${betweenSmallAndTile}`, expected: { kind: 'invalid' } },
    { query: `?w=${tileWidth}.0`, expected: { kind: 'invalid' } },
    { query: '?w=', expected: { kind: 'invalid' } },
  ])('reads "$query" as $expected.kind', ({ query, expected }) => {
    expect(request(query)).toEqual(expected as ReturnType<typeof request>);
  });

  it('stores each copy under its own name beside the original', () => {
    expect(variantKey(key, tileWidth)).toBe(`${key}.w${tileWidth}.webp`);
  });

  it('lists every width for an image wider than the largest copy', () => {
    expect(mediaSrcSet((width) => mediaUrl(key, width), photoWidth)).toBe(
      [smallWidth, tileWidth, largeWidth]
        .map((width) => `/api/media/${key}?w=${width} ${width}w`)
        .join(', '),
    );
  });

  it('lists a width past the original at the original width, once', () => {
    expect(mediaSrcSet(shortUrl, betweenSmallAndTile)).toBe(
      `${shortUrl(smallWidth)} ${smallWidth}w, ${shortUrl(tileWidth)} ${betweenSmallAndTile}w`,
    );
    expect(mediaSrcSet(shortUrl, belowSmall)).toBe(
      `${shortUrl(smallWidth)} ${belowSmall}w`,
    );
  });

  it('falls back to the nominal widths when the original width is unknown', () => {
    expect(mediaSrcSet(shortUrl, 0)).toBe(
      [smallWidth, tileWidth, largeWidth]
        .map((width) => `${shortUrl(width)} ${width}w`)
        .join(', '),
    );
  });
});
