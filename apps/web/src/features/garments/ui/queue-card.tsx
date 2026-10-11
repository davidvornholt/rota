import type { ReactNode, Ref } from 'react';

import type { GarmentImageView } from '#/shared/data/garment-view.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';

/** What the rule above a card says: nothing, a photo on its way, or a failure. */
export type QueueCardRule = 'plain' | 'moving' | 'failed';

type QueueCardProps = {
  readonly image: GarmentImageView | undefined;
  readonly eyebrow: string;
  readonly title: string;
  readonly rule?: QueueCardRule;
  readonly children: ReactNode;
  readonly ref?: Ref<HTMLLIElement>;
  readonly titleRef?: Ref<HTMLParagraphElement>;
};

/**
 * A garment that has not been read yet: the photo, what is happening to it, and
 * a sentence on what comes next. While the photo travels, a stretch of the
 * signal yellow runs along the rule above it, the way a tape is drawn out.
 */
export const QueueCard = ({
  image,
  eyebrow,
  title,
  rule = 'plain',
  children,
  ref,
  titleRef,
}: QueueCardProps) => (
  <li
    className={[
      'relative grid grid-cols-[6rem_1fr] gap-4 border-t py-5 sm:grid-cols-[10rem_1fr] sm:gap-6',
      rule === 'failed' ? 'border-ink' : 'border-rule',
    ].join(' ')}
    ref={ref}
  >
    {rule === 'moving' ? (
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -top-px h-0.5 overflow-hidden"
      >
        <span className="block size-full bg-signal motion-safe:w-1/3 motion-safe:animate-tape" />
      </span>
    ) : null}
    <GarmentFigure
      alt=""
      image={image}
      name="New garment"
      sizes="(min-width: 640px) 10rem, 6rem"
    />
    <div>
      <p className="type-eyebrow">{eyebrow}</p>
      <p
        className="type-display mt-1 text-ink text-xl sm:text-2xl"
        ref={titleRef}
        role="status"
        tabIndex={titleRef === undefined ? undefined : -1}
      >
        {title}
      </p>
      {children}
    </div>
  </li>
);
