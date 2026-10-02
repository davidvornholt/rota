/**
 * Smaller copies of stored images for the places that show them small. The
 * media route renders each width once, on first request, and keeps it next to
 * the original under a name derived from the original's key. Pure, so views and
 * the route can build and read the URLs without the store's configuration.
 */

/** Rows of small thumbnails, such as laundry and history pickers. */
export const smallWidth = 320;
/** Grid tiles, sharp at up to 3x density on a phone. */
export const tileWidth = 640;
/** The detail picture and the enlarged view. */
export const largeWidth = 1280;
export const variantWidths = [smallWidth, tileWidth, largeWidth] as const;
export type VariantWidth = (typeof variantWidths)[number];

export const variantMime = 'image/webp';

const widthParameter = 'w';

/** The URL of a stored image, or of its copy at one of the variant widths. */
export const mediaUrl = (key: string, width?: VariantWidth): string =>
  width === undefined
    ? `/api/media/${key}`
    : `/api/media/${key}?${widthParameter}=${width}`;

export type RequestedVariant =
  | { readonly kind: 'original' }
  | { readonly kind: 'variant'; readonly width: VariantWidth }
  | { readonly kind: 'invalid' };

/** Only the listed widths are rendered, so a request cannot fill the bucket with sizes. */
export const requestedVariant = (url: URL): RequestedVariant => {
  const value = url.searchParams.get(widthParameter);
  if (value === null) {
    return { kind: 'original' };
  }
  const width = variantWidths.find((candidate) => `${candidate}` === value);
  return width === undefined ? { kind: 'invalid' } : { kind: 'variant', width };
};

/** A copy's key: the original's content hash and extension, then the width. */
export const variantKey = (key: string, width: VariantWidth): string =>
  `${key}.w${width}.webp`;

/**
 * The `srcset` for a stored image. Copies are never enlarged, so a width past
 * the original's is listed at the original's width, and only once.
 */
export const mediaSrcSet = (
  urlFor: (width: VariantWidth) => string,
  sourceWidth: number,
): string => {
  // Studio renders whose header could not be read are stored with width 0.
  const limit = sourceWidth > 0 ? sourceWidth : Number.POSITIVE_INFINITY;
  const candidates = new Map<number, string>();
  for (const width of variantWidths) {
    const rendered = Math.min(width, limit);
    if (!candidates.has(rendered)) {
      candidates.set(rendered, urlFor(width));
    }
  }
  return Array.from(candidates, ([width, url]) => `${url} ${width}w`).join(
    ', ',
  );
};
