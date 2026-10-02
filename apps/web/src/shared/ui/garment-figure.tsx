import { colorName } from '#/shared/data/color-name.ts';
import type { GarmentColor } from '#/shared/data/garment-types.ts';
import type { GarmentImageView } from '#/shared/data/garment-view.ts';

type GarmentFigureProps = {
  readonly image: GarmentImageView | undefined;
  readonly name: string;
  readonly colors?: ReadonlyArray<GarmentColor>;
  readonly className?: string;
  /** The rendered width, as an `<img sizes>` value, so the smallest sharp copy loads. */
  readonly sizes: string;
  /** Images above the fold load eagerly; grids lazily. */
  readonly loading?: 'eager' | 'lazy';
  /** Empty when the picture is decoration beside a visible name. */
  readonly alt?: string;
};

/**
 * A picture still on its way fades in when it arrives; one the browser already
 * holds shows at once. The mark goes on the element itself, after the markup
 * is in place, so server-rendered pictures stay visible without JavaScript.
 */
const revealOnLoad = (image: HTMLImageElement | null) => {
  if (image === null || image.complete) {
    return;
  }
  image.dataset.loading = '';
  const reveal = () => {
    delete image.dataset.loading;
  };
  image.addEventListener('load', reveal, { once: true });
  image.addEventListener('error', reveal, { once: true });
  return () => {
    image.removeEventListener('load', reveal);
    image.removeEventListener('error', reveal);
  };
};

/**
 * A garment's picture in the fixed 3:4 frame. A studio render sits on the
 * paper; a phone photo fills the frame. A garment still without a picture shows
 * its dominant colour as a swatch, which is what the wardrobe knows about it.
 */
export const GarmentFigure = ({
  image,
  name,
  colors = [],
  className = '',
  sizes,
  loading = 'lazy',
  alt,
}: GarmentFigureProps) => {
  const [dominant] = colors;
  return (
    <span
      className={['garment-frame block', className].join(' ')}
      data-fit={image?.fit ?? 'contain'}
    >
      {image === undefined ? (
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center"
        >
          {dominant === undefined ? (
            <span className="type-display text-4xl text-ink-faint">
              {name.trim().charAt(0).toUpperCase() || '·'}
            </span>
          ) : (
            <svg
              className="size-full"
              preserveAspectRatio="none"
              role="img"
              viewBox="0 0 3 4"
            >
              <title>{`${name}, ${colorName(dominant.hex)}`}</title>
              <rect fill={dominant.hex} height={4} width={3} />
            </svg>
          )}
        </span>
      ) : (
        <img
          alt={alt ?? name}
          decoding="async"
          height={image.height}
          loading={loading}
          ref={revealOnLoad}
          sizes={sizes}
          src={image.url}
          srcSet={image.srcSet}
          width={image.width}
        />
      )}
    </span>
  );
};
