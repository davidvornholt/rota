import { useId, useRef } from 'react';

import type { GarmentView } from '#/shared/data/garment-view.ts';
import { PendingCard } from './pending-card.tsx';
import { ReviewCard } from './review-card.tsx';
import type { PhotoUploads } from './use-photo-uploads.ts';

type WaitingQueueProps = {
  readonly queue: ReadonlyArray<GarmentView>;
  readonly uploads: PhotoUploads;
  readonly categoryBudgets: Readonly<Record<string, number>>;
  readonly onChanged: () => void;
  /** Takes focus when the last card is removed and the queue goes with it. */
  readonly onEmptied: () => void;
};

/**
 * Everything not in the wardrobe yet, newest first: photos still on their way,
 * then the garments the server is reading or has read for review.
 */
export const WaitingQueue = ({
  queue,
  uploads,
  categoryBudgets,
  onChanged,
  onEmptied,
}: WaitingQueueProps) => {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const remove = (key: string) => {
    if (queue.length + uploads.pending.length > 1) {
      headingRef.current?.focus();
    } else {
      onEmptied();
    }
    uploads.discard(key);
  };
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2
        className="type-eyebrow"
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
      >
        Waiting to join
      </h2>
      <ul className="mt-2 border-rule border-b">
        {uploads.pending.map((photo) => (
          <PendingCard
            key={photo.key}
            onRemove={() => remove(photo.key)}
            onRetry={() => uploads.retry(photo.key)}
            photo={photo}
            reveal={photo.key === uploads.revealKey}
          />
        ))}
        {queue.map((garment) => (
          <ReviewCard
            categoryBudgets={categoryBudgets}
            garment={garment}
            key={`${garment.id}-${garment.status}`}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  );
};
