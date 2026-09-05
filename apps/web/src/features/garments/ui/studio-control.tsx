import { type GarmentView, isRendering } from '#/shared/data/garment-view.ts';
import { linkButtonClass } from '#/shared/ui/classes.ts';

const progressMessage = (
  garment: GarmentView,
  pending: boolean,
): string | null => {
  if (pending) {
    return 'Studio picture is queued.';
  }
  switch (garment.studioState.status) {
    case 'waiting':
      return 'Image service is busy. Retrying shortly.';
    case 'queued':
      return 'Studio picture is queued.';
    case 'rendering':
      return 'Making the studio picture…';
    default:
      return garment.studioError;
  }
};

const renderLabel = (garment: GarmentView): string => {
  if (garment.studioState.status === 'failed') {
    return 'Retry studio picture';
  }
  return garment.studio === undefined
    ? 'Render the studio picture'
    : 'Render again';
};

export const StudioControl = ({
  garment,
  pending,
  onRender,
}: {
  readonly garment: GarmentView;
  readonly pending: boolean;
  readonly onRender: () => void;
}) => {
  const busy = pending || isRendering(garment);
  const message = progressMessage(garment, pending);
  return (
    <div className="space-y-1">
      <p className="text-ink-muted text-sm" role="status">
        {message}
      </p>
      <button
        aria-busy={busy}
        className={[
          linkButtonClass,
          'disabled:cursor-wait disabled:text-ink-muted disabled:no-underline',
        ].join(' ')}
        disabled={busy}
        onClick={onRender}
        type="button"
      >
        {renderLabel(garment)}
      </button>
    </div>
  );
};
