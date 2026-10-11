const corners = [
  '-top-3 -left-3 border-t-2 border-l-2',
  '-top-3 -right-3 border-t-2 border-r-2',
  '-bottom-3 -left-3 border-b-2 border-l-2',
  '-bottom-3 -right-3 border-b-2 border-r-2',
] as const;

/**
 * Shown while pictures are dragged over the page. The whole page takes the
 * drop; the empty garment frame in the middle, marked out at its corners, says
 * what a dropped picture becomes. Hidden from assistive technology, which has
 * the buttons instead.
 */
export const DropOverlay = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-paper/90 p-10 motion-safe:animate-soft-reveal"
  >
    <div className="relative flex aspect-3/4 w-full max-w-60 flex-col items-center justify-center bg-paper-deep px-6 text-center">
      {corners.map((placement) => (
        <span
          className={`absolute size-7 border-ink ${placement}`}
          key={placement}
        />
      ))}
      <p className="type-display text-4xl text-ink">Drop to add</p>
      <p className="mt-3 text-ink-muted text-sm">
        Each picture becomes a garment in the queue.
      </p>
    </div>
  </div>
);
