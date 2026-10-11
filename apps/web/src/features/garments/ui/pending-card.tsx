import { useEffect, useRef } from 'react';

import { linkButtonClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { QueueCard } from './queue-card.tsx';
import { readingWords, sendingWords, waitingWords } from './queue-words.ts';
import type { PendingPhoto } from './use-photo-uploads.ts';

type PendingCardProps = {
  readonly photo: PendingPhoto;
  /** Brings the card into view: it is the newest of the photos just added. */
  readonly reveal: boolean;
  readonly onRetry: () => void;
  readonly onRemove: () => void;
};

const prefersReducedMotion = () =>
  globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

const wordsFor = {
  waiting: waitingWords,
  sending: sendingWords,
  sent: readingWords,
};

/**
 * A photo the page has but the queue does not show yet. It appears the moment
 * the photo is picked, pasted or dropped, so nothing seems to happen in
 * between; a photo that could not be sent stays here until it is sent again
 * or removed.
 */
export const PendingCard = ({
  photo,
  reveal,
  onRetry,
  onRemove,
}: PendingCardProps) => {
  const cardRef = useRef<HTMLLIElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const { state } = photo;
  const image = {
    url: photo.preview,
    srcSet: '',
    width: 3,
    height: 4,
    fit: 'cover',
  } as const;

  useEffect(() => {
    if (reveal) {
      cardRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
  }, [reveal]);

  if (state.phase === 'failed') {
    const retry = () => {
      // The buttons go once the photo is on its way; the title keeps focus.
      titleRef.current?.focus();
      onRetry();
    };
    return (
      <QueueCard
        eyebrow="Not added"
        image={image}
        ref={cardRef}
        rule="failed"
        title="The photo did not go through"
        titleRef={titleRef}
      >
        <p className="mt-2 max-w-prose text-ink text-sm" role="alert">
          {state.message}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {state.retryable ? (
            <button className={quietButtonClass} onClick={retry} type="button">
              Try again
            </button>
          ) : null}
          <button className={linkButtonClass} onClick={onRemove} type="button">
            Remove
          </button>
        </div>
      </QueueCard>
    );
  }

  const words = wordsFor[state.phase];
  return (
    <QueueCard
      eyebrow={words.eyebrow}
      image={image}
      ref={cardRef}
      rule={state.phase === 'sent' ? 'plain' : 'moving'}
      title={words.title}
      titleRef={titleRef}
    >
      <p className="mt-2 max-w-prose text-ink-muted text-sm">{words.body}</p>
    </QueueCard>
  );
};
