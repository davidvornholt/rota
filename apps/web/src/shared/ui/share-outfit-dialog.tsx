import { Effect } from 'effect';
import { useEffect, useState } from 'react';
import { drawCollagePicture } from '#/shared/collage/collage-picture.ts';
import {
  type CollageEntry,
  collageLabel,
  hasCollagePieces,
} from '#/shared/collage/collage-pieces.ts';
import { quietButtonClass, signalButtonClass } from './classes.ts';
import { Dialog } from './dialog.tsx';
import { IconButton } from './icon-button.tsx';
import { Notice } from './notice.tsx';
import { OutfitCollage } from './outfit-collage.tsx';

type Picture =
  | { readonly status: 'drawing' }
  | {
      readonly status: 'ready';
      readonly file: File;
      readonly url: string;
      readonly shareable: boolean;
    }
  | { readonly status: 'failed'; readonly message: string };

const themeColour = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
 * Draws the picture as soon as the dialog opens, so pressing Share hands the
 * finished file to the system sheet while the browser still counts the press.
 */
const usePicture = (
  entries: ReadonlyArray<CollageEntry>,
  title: string,
): Picture => {
  const [picture, setPicture] = useState<Picture>({ status: 'drawing' });
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setPicture({ status: 'drawing' });
    Effect.runPromise(
      drawCollagePicture(entries, {
        paper: themeColour('--color-paper-deep'),
        blank: themeColour('--color-rule'),
      }).pipe(Effect.result),
      { signal: controller.signal },
    )
      .then((result) => {
        if (result._tag === 'Failure') {
          setPicture({ status: 'failed', message: result.failure.message });
          return;
        }
        const file = new File([result.success], fileNameFor(title), {
          type: 'image/png',
        });
        url = URL.createObjectURL(file);
        setPicture({
          status: 'ready',
          file,
          url,
          shareable: canShareFile(file),
        });
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
  }, [entries, title]);
  return picture;
};

const Actions = ({
  picture,
  title,
}: {
  readonly picture: Picture;
  readonly title: string;
}) => {
  const [failure, setFailure] = useState('');
  if (picture.status === 'failed') {
    return <Notice live={true}>{picture.message}</Notice>;
  }
  const ready = picture.status === 'ready';
  const share = () => {
    if (!ready) {
      return;
    }
    setFailure('');
    navigator
      .share({ files: [picture.file], title })
      .catch((error: unknown) => {
        // Closing the share sheet without choosing an app is not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setFailure('The picture could not be shared. Download it instead.');
        }
      });
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {ready && picture.shareable ? (
          <button className={signalButtonClass} onClick={share} type="button">
            Share picture
          </button>
        ) : null}
        {ready ? (
          <a
            className={picture.shareable ? quietButtonClass : signalButtonClass}
            download={picture.file.name}
            href={picture.url}
          >
            Download picture
          </a>
        ) : (
          <span className="text-ink-muted text-sm" role="status">
            Preparing the picture …
          </span>
        )}
      </div>
      {failure === '' ? null : (
        <Notice className="mt-4" live={true}>
          {failure}
        </Notice>
      )}
    </>
  );
};

/**
 * The outfit as one picture to send or keep: the collage on screen, and the
 * same layout as a PNG behind the Share and Download buttons.
 */
const ShareOutfitDialog = ({
  entries: shownEntries,
  title,
  onClose,
}: {
  readonly entries: ReadonlyArray<CollageEntry>;
  readonly title: string;
  readonly onClose: () => void;
}) => {
  // The outfit as the dialog opened on: a refetch behind it must not redraw
  // the file the Share button is about to hand over.
  const [entries] = useState(shownEntries);
  const picture = usePicture(entries, title);
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
      <div className="mt-5">
        <Actions picture={picture} title={title} />
      </div>
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
