/**
 * The tally: one stroke per day a garment has been worn in its rotation, the
 * remaining days as ghost strokes. It is how Rota says "day 3 of 4" without a
 * number, and the one mark that appears everywhere a garment does.
 */

import { tallyLabel } from './tally-label.ts';

/** Past this many strokes the marks stop being readable, so digits take over. */
const strokeLimit = 7;

type TallyProps = {
  readonly day: number;
  readonly of: number;
  /** Draws the newest stroke in, for the moment an outfit is confirmed. */
  readonly animateLatest?: boolean;
  readonly size?: 'sm' | 'md';
};

const strokeSize = {
  sm: 'h-3.5 w-0.5',
  md: 'h-5 w-[3px]',
} as const;

type Stroke = {
  readonly day: number;
  readonly worn: boolean;
  readonly latest: boolean;
};

const strokesFor = (day: number, of: number): ReadonlyArray<Stroke> =>
  Array.from({ length: of }, (_, index) => ({
    day: index + 1,
    worn: index < day,
    latest: index === day - 1,
  }));

export const Tally = ({
  day,
  of,
  animateLatest = false,
  size = 'md',
}: TallyProps) => {
  const label = tallyLabel(day, of);
  if (of > strokeLimit) {
    return (
      <span
        aria-label={label}
        className="type-data text-ink-muted text-sm"
        role="img"
      >
        {day}
        <span aria-hidden="true"> / </span>
        {of}
      </span>
    );
  }
  return (
    <span
      aria-label={label}
      className="inline-flex items-end gap-[3px]"
      role="img"
    >
      {strokesFor(day, of).map((stroke) => (
        <span
          aria-hidden="true"
          className={[
            'inline-block origin-bottom',
            strokeSize[size],
            stroke.worn ? 'bg-ink' : 'bg-rule',
            stroke.worn && stroke.latest && animateLatest
              ? 'animate-stroke-in motion-reduce:animate-none'
              : '',
          ].join(' ')}
          key={stroke.day}
        />
      ))}
    </span>
  );
};
