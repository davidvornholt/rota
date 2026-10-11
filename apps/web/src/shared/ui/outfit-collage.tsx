import type { CollageRect } from '#/shared/collage/collage-layout.ts';
import {
  type CollageEntry,
  type PlacedArtwork,
  placeOutfit,
} from '#/shared/collage/collage-pieces.ts';

type OutfitCollageProps = {
  readonly entries: ReadonlyArray<CollageEntry>;
  /** Names the outfit for assistive technology; the pieces themselves are one picture. */
  readonly label: string;
  /**
   * The collage's rendered width as one CSS length, such as `min(100vw, 24rem)`.
   * Each piece derives its own `sizes` from it, so the smallest sharp copy loads.
   */
  readonly width: string;
  readonly className?: string;
  /** A collage above the fold loads eagerly; lists lazily. */
  readonly loading?: 'eager' | 'lazy';
};

/** Enough decimals that a piece lands on the same pixel as in the export. */
const decimals = 3;
const percentPerWhole = 100;

const percent = (fraction: number) =>
  `${(fraction * percentPerWhole).toFixed(decimals)}%`;

const placement = (rect: CollageRect) => ({
  left: percent(rect.left),
  top: percent(rect.top),
  width: percent(rect.width),
  height: percent(rect.height),
});

const Piece = ({
  piece,
  width,
  loading,
}: {
  readonly piece: PlacedArtwork;
  readonly width: string;
  readonly loading: 'eager' | 'lazy';
}) => {
  const { artwork } = piece;
  if (artwork.kind === 'swatch') {
    return (
      <span
        className="absolute bg-rule"
        // biome-ignore lint/nursery/noInlineStyles: The layout computes each piece's place per outfit, and a swatch shows the garment's own colour, not a theme token.
        style={{
          ...placement(piece.rect),
          backgroundColor: artwork.hex,
        }}
      />
    );
  }
  return (
    <img
      alt=""
      className={[
        'absolute block max-w-none',
        artwork.kind === 'photo' ? 'object-cover' : 'object-fill',
      ].join(' ')}
      decoding="async"
      height={artwork.image.height || undefined}
      loading={loading}
      sizes={`calc(${width} * ${piece.pictureRect.width.toFixed(decimals)})`}
      src={artwork.image.url}
      srcSet={artwork.image.srcSet}
      // biome-ignore lint/nursery/noInlineStyles: The layout computes each piece's place per outfit; no utility class can carry a computed rectangle.
      style={placement(piece.pictureRect)}
      width={artwork.image.width || undefined}
    />
  );
};

/**
 * An outfit laid out flat on the paper, the way a stylist would photograph
 * it: each garment cut out of its studio render and placed by slot. The image
 * export draws the same layout, so what is shared matches what is shown.
 */
export const OutfitCollage = ({
  entries,
  label,
  width,
  className = '',
  loading = 'lazy',
}: OutfitCollageProps) => (
  <div
    aria-label={label}
    className={[
      'relative aspect-4/5 w-full overflow-hidden bg-paper-deep',
      className,
    ].join(' ')}
    role="img"
  >
    {placeOutfit(entries).map((piece) => (
      <Piece key={piece.slot} loading={loading} piece={piece} width={width} />
    ))}
  </div>
);
