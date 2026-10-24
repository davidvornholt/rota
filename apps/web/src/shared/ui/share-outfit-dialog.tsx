import { useEffect, useState } from 'react';
import {
  type CollageEntry,
  collageLabel,
  hasCollagePieces,
} from '#/shared/collage/collage-entries.ts';
import type { CollagePicture } from '#/shared/collage/collage-state.ts';
import { quietButtonClass, signalButtonClass } from './classes.ts';
import { Dialog } from './dialog.tsx';
import { IconButton } from './icon-button.tsx';
import { Notice } from './notice.tsx';
import { OutfitCollage } from './outfit-collage.tsx';
import { useOutfitCollage } from './use-outfit-collage.ts';

/** A file name a phone and a desktop both keep as it is. */
const fileNameFor = (title: string) =>
  `${
    title
      .normalize('NFKD')
      .replace(/[^\w\s-]/gu, '')
      .trim()
      .replace(/\s+/gu, '-')
      .toLowerCase() || 'outfit'
  }.png`;

const canShareFile = (file: File) =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });

/**
 * Fetches the picture into a file as soon as it is there, so pressing Share
 * hands the file to the system sheet while the browser still counts the press.
 * Undefined while it loads, or where the browser cannot share files.
 */
const useShareableFile = (
  picture: CollagePicture | undefined,
  name: string,
): File | undefined => {
  const [file, setFile] = useState<File>();
  useEffect(() => {
    setFile(undefined);
    if (picture === undefined || typeof navigator.canShare !== 'function') {
      return;
    }
    const controller = new AbortController();
    fetch(picture.url, { signal: controller.signal })
      .then((response) => (response.ok ? response.blob() : undefined))
      .then((blob) => {
        if (blob === undefined) {
          return;
        }
        const candidate = new File([blob], name, { type: 'image/png' });
        if (canShareFile(candidate)) {
          setFile(candidate);
        }
      })
      // Without the file the dialog still offers the download.
      .catch(() => undefined);
    return () => controller.abort();
  }, [picture, name]);
  return file;
};

const Actions = ({
  entries,
  title,
}: {
  readonly entries: ReadonlyArray<CollageEntry>;
  readonly title: string;
}) => {
  const { state } = useOutfitCollage(entries);
  const picture = state?.status === 'ready' ? state.picture : undefined;
  const name = fileNameFor(title);
  const file = useShareableFile(picture, name);
  const [failure, setFailure] = useState('');
  if (picture === undefined) {
    return null;
  }
  const share = () => {
    if (file === undefined) {
      return;
    }
    setFailure('');
    navigator.share({ files: [file], title }).catch((error: unknown) => {
      // Closing the share sheet without choosing an app is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setFailure('The picture could not be shared. Download it instead.');
      }
    });
  };
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        {file === undefined ? null : (
          <button className={signalButtonClass} onClick={share} type="button">
            Share picture
          </button>
        )}
        <a
          className={file === undefined ? signalButtonClass : quietButtonClass}
          download={name}
          href={picture.url}
        >
          Download picture
        </a>
      </div>
      {failure === '' ? null : (
        <Notice className="mt-4" live={true}>
          {failure}
        </Notice>
      )}
    </div>
  );
};

/**
 * The outfit as one picture to send or keep: the collage, and the same
 * picture behind the Share and Download buttons once it has been made.
 */
export const ShareOutfitDialog = ({
  entries: shownEntries,
  title,
  onClose,
}: {
  readonly entries: ReadonlyArray<CollageEntry>;
  readonly title: string;
  readonly onClose: () => void;
}) => {
  // The outfit as the dialog opened on: a refetch behind it must not swap
  // the picture the Share button is about to hand over.
  const [entries] = useState(shownEntries);
  return (
    <Dialog
      eyebrow="Share as picture"
      onClose={onClose}
      open={true}
      title={title}
    >
      <OutfitCollage
        className="mx-auto max-w-sm border border-rule"
        entries={entries}
        label={collageLabel(title, entries)}
        loading="eager"
        width="min(100vw - 2.5rem, 24rem)"
      />
      <Actions entries={entries} title={title} />
    </Dialog>
  );
};

/** Opens the outfit as a picture to share or download. */
export const ShareOutfitButton = ({
  entries,
  title,
  label = 'Share as picture',
  disabled = false,
}: {
  readonly entries: ReadonlyArray<CollageEntry>;
  /** The outfit's name or day; it heads the dialog and names the file. */
  readonly title: string;
  readonly label?: string;
  readonly disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        disabled={disabled || !hasCollagePieces(entries)}
        icon="share"
        label={label}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <ShareOutfitDialog
          entries={entries}
          onClose={() => setOpen(false)}
          title={title}
        />
      ) : null}
    </>
  );
};
