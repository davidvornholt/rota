import type { StudioProgress } from '#/shared/ai/studio-progress.ts';
import {
  type CollageEntry,
  collageGarments,
} from '#/shared/collage/collage-entries.ts';
import { linkButtonClass } from './classes.ts';
import { GarmentFigure } from './garment-figure.tsx';
import {
  type OutfitCollageQuery,
  useOutfitCollage,
} from './use-outfit-collage.ts';

type OutfitCollageProps = {
  readonly entries: ReadonlyArray<CollageEntry>;
  /** Names the outfit for assistive technology; the pieces themselves are one picture. */
  readonly label: string;
  /** The collage's rendered width as one CSS length, such as `min(100vw, 24rem)`, so the smallest sharp copy loads. */
  readonly width: string;
  readonly className?: string;
  /** A collage above the fold loads eagerly; lists lazily. */
  readonly loading?: 'eager' | 'lazy';
};

const progressMessage = (progress: StudioProgress): string => {
  switch (progress.status) {
    case 'queued':
      return 'Waiting for another picture to finish.';
    case 'waiting':
      return 'The image service is busy. Rota tries again shortly.';
    default:
      return 'Making the picture. This takes about a minute.';
  }
};

const statusMessage = ({ state, unavailable }: OutfitCollageQuery): string => {
  if (state?.status === 'failed') {
    return state.message;
  }
  if (unavailable) {
    return 'The picture could not be loaded.';
  }
  return state?.status === 'pending' ? progressMessage(state.progress) : '';
};

/**
 * What the frame says under the garments while the picture is not there. The
 * status element stays in place while its words change, so a screen reader
 * hears each change.
 */
const CollageStatus = ({
  collage,
}: {
  readonly collage: OutfitCollageQuery;
}) => {
  const message = statusMessage(collage);
  const failed = collage.unavailable || collage.state?.status === 'failed';
  return (
    <div
      className={
        message === ''
          ? undefined
          : 'absolute inset-x-0 bottom-0 flex min-h-11 flex-wrap items-center justify-between gap-x-3 bg-paper/90 px-3 text-ink-muted text-xs'
      }
    >
      <p className={message === '' ? 'sr-only' : 'py-2'} role="status">
        {message}
      </p>
      {failed ? (
        <button
          className={`${linkButtonClass} text-xs`}
          disabled={collage.retrying}
          onClick={collage.retry}
          type="button"
        >
          {collage.retrying ? 'Trying again …' : 'Try again'}
        </button>
      ) : null}
    </div>
  );
};

/** Two columns hold up to four garments; five or six need three. */
const twoColumnLimit = 4;

/** Each garment's share of the frame's width, so up to six fit side by side. */
const cellFor = (count: number) => {
  if (count > twoColumnLimit) {
    return { className: 'w-[30%]', share: 0.3 };
  }
  return count > 1
    ? { className: 'w-[45%]', share: 0.45 }
    : { className: 'w-3/5', share: 0.6 };
};

/**
 * The outfit as one flat-lay picture the image model made from its garment
 * pictures. Until the picture is there, the frame shows the garments side by
 * side and says what is happening.
 */
export const OutfitCollage = ({
  entries,
  label,
  width,
  className = '',
  loading = 'lazy',
}: OutfitCollageProps) => {
  const collage = useOutfitCollage(entries);
  const frame = [
    'relative aspect-4/5 w-full overflow-hidden bg-paper-deep',
    className,
  ].join(' ');
  const { state } = collage;
  if (state?.status === 'ready') {
    const { picture } = state;
    return (
      <div className={frame}>
        <img
          alt={label}
          className="block size-full object-cover"
          decoding="async"
          height={picture.height}
          loading={loading}
          sizes={width}
          src={picture.url}
          srcSet={picture.srcSet}
          width={picture.width}
        />
      </div>
    );
  }
  const garments = collageGarments(entries);
  const cell = cellFor(garments.length);
  return (
    <div className={frame}>
      <div
        aria-label={label}
        className="flex size-full flex-wrap place-content-center items-center gap-2 p-4 pb-10"
        role="img"
      >
        {garments.map(({ slot, garment }) => (
          <GarmentFigure
            alt=""
            className={cell.className}
            image={garment.image}
            key={slot}
            loading={loading}
            name={garment.name}
            sizes={`calc((${width}) * ${cell.share})`}
          />
        ))}
      </div>
      {state?.status === 'empty' ? null : <CollageStatus collage={collage} />}
    </div>
  );
};
