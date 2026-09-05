import { ConfirmButton } from '#/shared/ui/confirm-button.tsx';

export const ResetPhotoControl = ({
  onReset,
  pending,
}: {
  readonly onReset: () => void;
  readonly pending: boolean;
}) => (
  <details className="text-sm">
    <summary className="min-h-11 cursor-pointer py-3 text-ink-muted">
      More options
    </summary>
    <p className="max-w-prose text-ink-muted">
      Resetting replaces your edits with a new analysis of the original photo
      and regenerates the studio image. You will need to review the details
      again.
    </p>
    <ConfirmButton
      label="Reset details from photo"
      confirmLabel="Replace edits and regenerate image"
      onConfirm={onReset}
      pending={pending}
      tone="link"
    />
  </details>
);
