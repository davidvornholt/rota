import { linkButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { PhotoPicker } from './photo-picker.tsx';

type ReplacePhotoControlProps = {
  readonly onPick: (file: File) => void;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly error: unknown;
  readonly complete: boolean;
  /** Whether a studio picture exists that the new photo has now left behind. */
  readonly hasStudio: boolean;
};

const failureMessage = (error: unknown) =>
  error instanceof Error && error.message !== ''
    ? error.message
    : 'The photo could not be replaced. Try again.';

/**
 * Retake the photo at the wardrobe or pick a better picture from the library.
 * The new picture shows at once; the studio render is the wearer's to redo.
 */
export const ReplacePhotoControl = ({
  onPick,
  pending,
  disabled,
  error,
  complete,
  hasStudio,
}: ReplacePhotoControlProps) => {
  const pick = (files: ReadonlyArray<File>) => {
    const [file] = files;
    if (file !== undefined) {
      onPick(file);
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <PhotoPicker
          busy={pending}
          camera={true}
          className={`${linkButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={disabled}
          label="Retake the photo"
          onPick={pick}
        />
        <PhotoPicker
          busy={pending}
          className={`${linkButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={disabled}
          label="Choose a picture"
          onPick={pick}
        />
      </div>
      {pending ? (
        <p className="text-ink-muted text-sm" role="status">
          Replacing the photo …
        </p>
      ) : null}
      {complete && !pending && error === null ? (
        <p className="text-ink-muted text-sm" role="status">
          Photo replaced.
          {hasStudio
            ? ' The studio picture still shows the old photo; regenerate it below when you want a new one.'
            : ''}
        </p>
      ) : null}
      {error === null || pending ? null : (
        <Notice live={true}>{failureMessage(error)}</Notice>
      )}
    </div>
  );
};
