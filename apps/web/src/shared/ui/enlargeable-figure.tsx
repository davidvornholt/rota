import { useId, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { GarmentColor } from '#/shared/data/garment-types.ts';
import type { GarmentImageView } from '#/shared/data/garment-view.ts';
import { linkButtonClass } from './classes.ts';
import { GarmentFigure } from './garment-figure.tsx';
import { Swatches } from './swatches.tsx';

type EnlargeableFigureProps = {
  readonly image: GarmentImageView | undefined;
  readonly name: string;
  readonly colors?: ReadonlyArray<GarmentColor>;
  /** The line under the large picture, after the name; "Studio render" or "Photo". */
  readonly caption?: string;
  readonly className?: string;
  readonly loading?: 'lazy' | 'eager';
};

const prefersReducedMotion = () =>
  globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs a state change as a view transition when the browser can and the
 * wearer has not asked for less motion; otherwise applies it at once. The
 * returned promise settles when the transition has finished either way.
 */
const transition = (update: () => void): Promise<void> => {
  if (!('startViewTransition' in document) || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document
    .startViewTransition(() => flushSync(update))
    .finished.then(() => undefined);
};

/**
 * A garment picture that opens large when pressed. The thumbnail carries the
 * transition name only while it is the one opening or closing, so the browser
 * morphs it into the large picture and back; every other figure on the page
 * stays unnamed and out of the way.
 */
export const EnlargeableFigure = ({
  image,
  name,
  colors,
  caption,
  className,
  loading,
}: EnlargeableFigureProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  // The name has to be on the thumbnail before the old snapshot is taken,
  // and on the large picture by the time the new one is: flushSync commits
  // each step where the transition expects it.
  const settle = () => setMoving(false);
  const move = (next: boolean) => {
    flushSync(() => setMoving(true));
    transition(() => setOpen(next)).then(settle, settle);
  };
  const show = () => move(true);
  const hide = () => move(false);

  if (image === undefined) {
    return (
      <GarmentFigure
        alt=""
        className={className}
        colors={colors}
        image={undefined}
        name={name}
      />
    );
  }

  return (
    <>
      <button
        aria-label={`Show ${name} large`}
        className={['group block w-full text-left', className].join(' ')}
        onClick={show}
        type="button"
      >
        <GarmentFigure
          alt=""
          className={[
            'transition-opacity group-hover:opacity-90',
            moving && !open ? 'lightbox-image' : '',
          ].join(' ')}
          colors={colors}
          image={image}
          loading={loading}
          name={name}
        />
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-0 h-svh max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-ink/80"
        onCancel={(event) => {
          event.preventDefault();
          hide();
        }}
        onClose={() => setOpen(false)}
        ref={dialog}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-6 border-rule border-b px-5 py-3 sm:px-8">
            <p
              className="type-display text-ink text-xl sm:text-2xl"
              id={titleId}
            >
              {name}
              {caption === undefined ? null : (
                <span className="text-ink-faint"> · {caption}</span>
              )}
            </p>
            <div className="flex items-center gap-5">
              {colors === undefined ? null : (
                <Swatches colors={colors} size="md" />
              )}
              <button className={linkButtonClass} onClick={hide} type="button">
                Close
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-5 sm:p-8">
            {open || moving ? (
              <img
                alt={name}
                className={[
                  'max-h-full max-w-full object-contain',
                  open ? 'lightbox-image' : '',
                ].join(' ')}
                decoding="async"
                height={image.height}
                src={image.url}
                width={image.width}
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
};
