import { useId } from 'react';
import { type GarmentView, isRendering } from '#/shared/data/garment-view.ts';
import {
  fieldClass,
  labelClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { renderInstructionsLength } from '../schemas/garment-input.ts';

type StudioRenderControlProps = {
  readonly garment: GarmentView;
  readonly context: 'review' | 'wardrobe';
  readonly instructions: string;
  readonly onInstructionsChange: (value: string) => void;
  readonly onRender: () => void;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly error: unknown;
  readonly complete: boolean;
};

const progressMessage = (garment: GarmentView): string => {
  switch (garment.studioState.status) {
    case 'waiting':
      return 'Image service is busy. Retrying shortly.';
    case 'preparing':
      return 'Preparing studio picture.';
    case 'queued':
      return 'Waiting for a free image slot. Your picture will start automatically.';
    default:
      return 'Rendering … this may take a few minutes.';
  }
};

export const StudioRenderControl = ({
  garment,
  context,
  instructions,
  onInstructionsChange,
  onRender,
  pending,
  disabled,
  error,
  complete,
}: StudioRenderControlProps) => {
  const id = useId();
  const busy = pending || isRendering(garment);
  const failure = error instanceof Error ? error.message : garment.studioError;
  return (
    <div className="mt-3 grid gap-2">
      <label className={labelClass} htmlFor={id}>
        Image instructions, optional
      </label>
      <textarea
        id={id}
        className={fieldClass}
        disabled={busy}
        maxLength={renderInstructionsLength}
        rows={2}
        placeholder="For example, make the blue darker and keep the white buttons."
        value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
      />
      <p className="text-ink-muted text-sm">
        {context === 'review'
          ? 'Uses your current edits. Add to wardrobe saves the details and your chosen picture when you are ready.'
          : 'Uses and saves your current edits.'}{' '}
        The current picture stays until the new one is ready.
      </p>
      <button
        aria-busy={busy}
        className={`${linkButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled || busy}
        onClick={onRender}
        type="button"
      >
        {garment.studio === undefined
          ? 'Generate studio image'
          : 'Regenerate studio image'}
      </button>
      {busy ? (
        <p className="text-ink-muted text-sm" role="status">
          {progressMessage(garment)}
        </p>
      ) : null}
      {complete && !busy && failure === null ? (
        <p className="text-ink-muted text-sm" role="status">
          Studio picture updated.
        </p>
      ) : null}
      {failure === null || busy ? null : <Notice live={true}>{failure}</Notice>}
    </div>
  );
};
