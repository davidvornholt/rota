import { Effect, Semaphore } from 'effect';
import { useEffect, useRef, useState } from 'react';

import { uploadPhoto } from './upload-photo.ts';

export type PendingState =
  | { readonly phase: 'waiting' }
  | { readonly phase: 'sending' }
  | { readonly phase: 'sent'; readonly garmentId: string }
  | {
      readonly phase: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

export type PendingPhoto = {
  readonly key: string;
  /** The photo as picked, shown until the garment it opens is in the queue. */
  readonly preview: string;
  readonly state: PendingState;
};

type Picked = { readonly file: File; readonly preview: string };

/**
 * A photo decodes at full size before it shrinks; two at a time keeps a phone
 * within its memory while a long batch still moves.
 */
const lanes = 2;

const hasLanded =
  (known: ReadonlySet<string>) =>
  (photo: PendingPhoto): boolean =>
    photo.state.phase === 'sent' && known.has(photo.state.garmentId);

/** Lets go of a photo the page no longer shows. */
const release = (picked: Map<string, Picked>, key: string) => {
  const entry = picked.get(key);
  if (entry !== undefined) {
    URL.revokeObjectURL(entry.preview);
    picked.delete(key);
  }
};

/**
 * Photos on their way into the wardrobe. Each is sent on its own and shows a
 * card at once; the card steps aside when the server's garment for it reaches
 * `known`, so the queue never shows a photo twice or not at all.
 */
export const usePhotoUploads = ({
  known,
  onSent,
}: {
  /** Ids of every garment the page already shows. */
  readonly known: ReadonlySet<string>;
  readonly onSent: () => void;
}) => {
  const [photos, setPhotos] = useState<ReadonlyArray<PendingPhoto>>([]);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [semaphore] = useState(() => Semaphore.makeUnsafe(lanes));
  const pickedRef = useRef(new Map<string, Picked>());
  const nextKeyRef = useRef(0);

  const update = (key: string, state: PendingState) =>
    setPhotos((list) =>
      list.map((photo) => (photo.key === key ? { ...photo, state } : photo)),
    );

  const send = (key: string, file: File) => {
    Effect.runFork(
      Effect.sync(() => update(key, { phase: 'sending' })).pipe(
        Effect.andThen(uploadPhoto(file)),
        semaphore.withPermits(1),
        Effect.match({
          onSuccess: (garmentId) => {
            update(key, { phase: 'sent', garmentId });
            onSent();
          },
          onFailure: ({ message, retryable }) =>
            update(key, { phase: 'failed', message, retryable }),
        }),
      ),
    );
  };

  const add = (files: ReadonlyArray<File>) => {
    const entries = files.map((file) => {
      nextKeyRef.current += 1;
      const key = `pending-${nextKeyRef.current}`;
      const preview = URL.createObjectURL(file);
      pickedRef.current.set(key, { file, preview });
      return { key, file, preview };
    });
    // Newest first, the order the queue lists garments in, so nothing moves
    // when a card hands over to the server's.
    const fresh = [...entries].reverse().map(({ key, preview }) => ({
      key,
      preview,
      state: { phase: 'waiting' } as const,
    }));
    setPhotos((list) => [...fresh, ...list]);
    setRevealKey(fresh[0]?.key ?? null);
    for (const { key, file } of entries) {
      send(key, file);
    }
  };

  const retry = (key: string) => {
    const entry = pickedRef.current.get(key);
    if (entry !== undefined) {
      update(key, { phase: 'waiting' });
      send(key, entry.file);
    }
  };

  const discard = (key: string) => {
    release(pickedRef.current, key);
    setPhotos((list) => list.filter((photo) => photo.key !== key));
  };

  // Once the queue shows the garment, its card and preview are done with.
  useEffect(() => {
    const arrived = photos.filter(hasLanded(known)).map((photo) => photo.key);
    if (arrived.length === 0) {
      return;
    }
    for (const key of arrived) {
      release(pickedRef.current, key);
    }
    setPhotos((list) => list.filter((photo) => !arrived.includes(photo.key)));
  }, [photos, known]);

  useEffect(() => {
    const { current } = pickedRef;
    return () => {
      for (const key of [...current.keys()]) {
        release(current, key);
      }
    };
  }, []);

  return {
    /** Photos without a garment in the queue yet, newest first. */
    pending: photos.filter((photo) => !hasLanded(known)(photo)),
    revealKey,
    add,
    retry,
    discard,
  };
};

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;
