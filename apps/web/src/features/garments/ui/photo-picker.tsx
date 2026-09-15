import { type ChangeEvent, useRef } from 'react';

type PhotoPickerProps = {
  readonly label: string;
  readonly className: string;
  /** Opens the camera rather than the photo library where the device has one. */
  readonly camera?: boolean;
  readonly multiple?: boolean;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly onPick: (files: ReadonlyArray<File>) => void;
};

/**
 * A button that opens the file chooser. The input is not rendered at all so
 * the button is the one control assistive technology hears about; the label
 * on the input names it for tests that hand it files directly.
 */
export const PhotoPicker = ({
  label,
  className,
  camera = false,
  multiple = false,
  busy,
  disabled = false,
  onPick,
}: PhotoPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    onPick(files);
  };
  return (
    <>
      <input
        accept="image/*"
        aria-label={label}
        capture={camera ? 'environment' : undefined}
        hidden={true}
        multiple={multiple}
        onChange={onChange}
        ref={inputRef}
        type="file"
      />
      <button
        aria-busy={busy}
        className={className}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {label}
      </button>
    </>
  );
};
