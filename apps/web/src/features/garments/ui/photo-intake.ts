import { Effect } from 'effect';

/**
 * What a paste, a drop, or the clipboard held. Pictures go to the wardrobe;
 * anything else that looks meant for it gets a sentence saying what to do.
 */
export type Intake =
  | {
      readonly kind: 'pictures';
      readonly files: ReadonlyArray<File>;
      /** Files that came along but are not pictures; they are left out. */
      readonly skipped: number;
    }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'nothing' };

/** The parts of a `DataTransfer` this reads; a paste and a drop both carry one. */
export type Transfer = {
  readonly files: ArrayLike<File>;
  readonly getData: (format: string) => string;
};

const webAddress = /^https?:\/\/\S+$/iu;

const linkMessage =
  'That is a link to a picture, not the picture itself. Copy the image, then paste it here.';
const notPictureMessage =
  'Only pictures can be added to the wardrobe. Paste or drop a photo of the garment.';
const emptyClipboardMessage =
  'The clipboard has no picture in it. Copy an image, then paste it here.';

const isPicture = (file: File) => file.type.startsWith('image/');

/** A dropped link may be a list; its first line is the address. */
const isLink = (text: string) =>
  webAddress.test(text.trim().split('\n')[0]?.trim() ?? '');

const refused = (message: string): Intake => ({ kind: 'refused', message });

/** Reads a paste or a drop. Text that is not a link is not meant for the wardrobe. */
export const intakeOf = (transfer: Transfer): Intake => {
  const files = Array.from(transfer.files);
  const pictures = files.filter(isPicture);
  if (pictures.length > 0) {
    return {
      kind: 'pictures',
      files: pictures,
      skipped: files.length - pictures.length,
    };
  }
  if (files.length > 0) {
    return refused(notPictureMessage);
  }
  const text =
    transfer.getData('text/uri-list') || transfer.getData('text/plain');
  return isLink(text) ? refused(linkMessage) : { kind: 'nothing' };
};

const fileExtension = (mime: string) =>
  mime.slice('image/'.length).split('+')[0] || 'png';

/** One clipboard entry as a picture file, or nothing when it holds none. */
const pictureIn = async (item: ClipboardItem): Promise<File | undefined> => {
  const type = item.types.find((candidate) => candidate.startsWith('image/'));
  if (type === undefined) {
    return undefined;
  }
  const blob = await item.getType(type);
  return new File([blob], `pasted.${fileExtension(type)}`, { type });
};

const textIn = async (item: ClipboardItem): Promise<string> =>
  item.types.includes('text/plain')
    ? (await item.getType('text/plain')).text()
    : '';

/** The clipboard's pictures, or why it holds none the wardrobe can use. */
const intakeOfClipboard = async (
  items: ReadonlyArray<ClipboardItem>,
): Promise<Intake> => {
  const found = await Promise.all(items.map(pictureIn));
  const files = found.filter((file) => file !== undefined);
  if (files.length > 0) {
    return { kind: 'pictures', files, skipped: 0 };
  }
  const texts = await Promise.all(items.map(textIn));
  return refused(texts.some(isLink) ? linkMessage : emptyClipboardMessage);
};

/**
 * Reads the clipboard for the paste button. The browser may ask first; a
 * refusal or a clipboard without a picture comes back as a sentence, never as
 * a failure. `pasteKeys` names the shortcut that still works when it refuses.
 */
export const readClipboard = (pasteKeys: string): Effect.Effect<Intake> =>
  Effect.suspend(() => {
    // Absent outside secure contexts, even though the DOM types promise it.
    if (!('clipboard' in navigator && 'read' in navigator.clipboard)) {
      return Effect.succeed(
        refused(
          `This browser cannot paste from a button. Press ${pasteKeys} instead.`,
        ),
      );
    }
    return Effect.tryPromise({
      try: () => navigator.clipboard.read(),
      catch: (cause) => cause,
    }).pipe(
      Effect.flatMap((items) =>
        Effect.tryPromise({
          try: () => intakeOfClipboard(items),
          catch: (cause) => cause,
        }),
      ),
      Effect.catch((cause) =>
        Effect.succeed(
          refused(
            cause instanceof DOMException && cause.name === 'NotAllowedError'
              ? `The browser did not let Rota read the clipboard. Press ${pasteKeys} instead, or allow clipboard access for this site.`
              : emptyClipboardMessage,
          ),
        ),
      ),
    );
  });
