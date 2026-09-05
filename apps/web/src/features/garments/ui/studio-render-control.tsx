import { useId } from 'react';
import {
  fieldClass,
  labelClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { renderInstructionsLength } from '../schemas/garment-input.ts';

type StudioRenderControlProps = {
  readonly hasStudio: boolean;
  readonly instructions: string;
  readonly onInstructionsChange: (value: string) => void;
  readonly onRender: () => void;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly error: unknown;
  readonly complete: boolean;
};

export const StudioRenderControl = ({
  hasStudio,
  instructions,
  onInstructionsChange,
  onRender,
  pending,
  disabled,
  error,
  complete,
}: StudioRenderControlProps) => {
  const id = useId();
  return (
    <div className="mt-3 grid gap-2">
      <label className={labelClass} htmlFor={id}>
        Render instructions, optional
      </label>
      <textarea
        id={id}
        className={fieldClass}
        disabled={pending}
        maxLength={renderInstructionsLength}
        rows={2}
        placeholder="For example, make the blue darker and keep the white buttons."
        value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
      />
      <p className="text-ink-muted text-sm">
        Saves the current fields and makes a new studio picture from your photo.
        The current picture stays until the new one is ready.
      </p>
      <button
        aria-busy={pending}
        className={`${linkButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled || pending}
        onClick={onRender}
        type="button"
      >
        {hasStudio
          ? 'Save changes and render again'
          : 'Save changes and render studio picture'}
      </button>
      {pending ? (
        <p className="text-ink-muted text-sm" role="status">
          Rendering … this may take a few minutes.
        </p>
      ) : null}
      {complete && !pending ? (
        <p className="text-ink-muted text-sm" role="status">
          Studio picture updated.
        </p>
      ) : null}
      {error === null ? null : (
        <Notice live={true}>
          {error instanceof Error
            ? error.message
            : 'The studio picture could not be rendered. Try again.'}
        </Notice>
      )}
    </div>
  );
};
