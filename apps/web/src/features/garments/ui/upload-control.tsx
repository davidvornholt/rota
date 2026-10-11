import { Effect } from 'effect';
import { ClipboardPaste } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { quietButtonClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { type Intake, intakeOf, readClipboard } from './photo-intake.ts';
import { PhotoPicker } from './photo-picker.tsx';

type PasteKeys = { readonly label: string; readonly aria: string };

const noSubscription = () => () => undefined;
const apple: PasteKeys = { label: '⌘V', aria: 'Meta+V' };
const others: PasteKeys = { label: 'Ctrl+V', aria: 'Control+V' };
const appleDevice = /Mac|iPhone|iPad/u;
const pasteKeysHere = () =>
  appleDevice.test(navigator.userAgent) ? apple : others;

/**
 * The paste shortcut as this device writes it, or null while rendering on the
 * server, where the device is not known yet.
 */
const usePasteKeys = () =>
  useSyncExternalStore(noSubscription, pasteKeysHere, () => null);

/** The chooser's files read like a drop, so a stray document is named the same way. */
const picked = (files: ReadonlyArray<File>): Intake =>
  intakeOf({ files, getData: () => '' });

type UploadControlProps = {
  readonly onIntake: (intake: Intake) => void;
};

/**
 * Every way in. The camera, for standing at the wardrobe; the photo library,
 * for a batch; and the clipboard, for a picture found elsewhere. A paste or a
 * drop anywhere on the page does the same as these buttons.
 */
export const UploadControl = ({ onIntake }: UploadControlProps) => {
  const pasteKeys = usePasteKeys();
  const [reading, setReading] = useState(false);

  const paste = () => {
    setReading(true);
    Effect.runFork(
      readClipboard((pasteKeys ?? others).label).pipe(
        Effect.andThen((intake) =>
          Effect.sync(() => {
            setReading(false);
            onIntake(intake);
          }),
        ),
      ),
    );
  };

  return (
    <div className="flex flex-wrap gap-3">
      <PhotoPicker
        busy={false}
        camera={true}
        className={signalButtonClass}
        label="Photograph a garment"
        onPick={(files) => onIntake(picked(files))}
      />
      <PhotoPicker
        busy={false}
        className={quietButtonClass}
        label="Choose photos"
        multiple={true}
        onPick={(files) => onIntake(picked(files))}
      />
      <button
        aria-busy={reading}
        aria-keyshortcuts={pasteKeys?.aria}
        aria-label="Paste"
        className={quietButtonClass}
        disabled={reading}
        onClick={paste}
        type="button"
      >
        <ClipboardPaste
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={1.5}
        />
        Paste
        {pasteKeys === null ? null : (
          <kbd className="type-data pointer-fine:inline hidden font-sans text-ink-faint text-xs">
            {pasteKeys.label}
          </kbd>
        )}
      </button>
    </div>
  );
};
