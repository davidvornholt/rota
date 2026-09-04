import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useState } from 'react';
import {
  type Slot,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { frameClass, tabActiveClass, tabClass } from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { Swatches } from '#/shared/ui/swatches.tsx';
import type { WardrobeView } from '../services/garments-fns.ts';
import { ReviewCard } from './review-card.tsx';
import { UploadControl } from './upload-control.tsx';

type Filter = 'all' | Slot;

const filters: ReadonlyArray<{ readonly key: Filter; readonly label: string }> =
  [
    { key: 'all', label: 'All' },
    ...slotOrder.map((slot) => ({ key: slot, label: slotLabel[slot] })),
  ];

const wearWords = (garment: GarmentView): string => {
  if (garment.wears === 0) {
    return 'Not worn yet';
  }
  const wears = `${garment.wears}×`;
  if (garment.daysSinceWorn === null) {
    return wears;
  }
  return `${wears} · ${garment.daysSinceWorn === 0 ? 'today' : `${garment.daysSinceWorn} d ago`}`;
};

const GarmentCell = ({ garment }: { readonly garment: GarmentView }) => (
  <li>
    <Link
      className="group block border border-transparent p-1 transition-colors hover:border-ink focus-visible:border-ink"
      params={{ garmentId: garment.id }}
      to="/wardrobe/$garmentId"
    >
      <GarmentFigure
        alt=""
        colors={garment.colors}
        image={garment.image}
        name={garment.name}
      />
      <span className="mt-2 block text-ink text-sm leading-snug">
        {garment.name}
      </span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="type-data text-ink-faint text-xs">
          {wearWords(garment)}
        </span>
        <Swatches colors={garment.colors} />
      </span>
    </Link>
  </li>
);

const pollInterval = 4000;

/**
 * The wardrobe: a contact sheet of every garment, with the ingest queue above
 * it while anything is still being read. Uploads land in the queue at once;
 * while a garment is processing the page asks the loader for news every few
 * seconds, so the card fills in without a reload.
 */
export const WardrobePage = ({
  view,
  categoryBudgets,
}: {
  readonly view: WardrobeView;
  readonly categoryBudgets: Readonly<Record<string, number>>;
}) => {
  const router = useRouter();
  const headingId = useId();
  const queueHeadingId = useId();
  const [filter, setFilter] = useState<Filter>('all');
  const [showRetired, setShowRetired] = useState(false);
  const processing = view.queue.some(
    (garment) => garment.status === 'processing',
  );
  useEffect(() => {
    if (!processing) {
      return;
    }
    const timer = setInterval(() => {
      router.invalidate().catch(() => undefined);
    }, pollInterval);
    return () => clearInterval(timer);
  }, [processing, router]);

  const refresh = () => router.invalidate().catch(() => undefined);
  const shown = (showRetired ? view.retired : view.active).filter(
    (garment) => filter === 'all' || garment.slots.includes(filter),
  );

  return (
    <div className={frameClass}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-rule border-b pb-4">
        <div>
          <h1
            className="type-display text-4xl text-ink sm:text-5xl"
            id={headingId}
          >
            Wardrobe
          </h1>
          <p className="type-data mt-1 text-ink-muted text-sm">
            {view.active.length} garment{view.active.length === 1 ? '' : 's'}
            {view.retired.length > 0 ? ` · ${view.retired.length} retired` : ''}
            {view.queue.length > 0 ? ` · ${view.queue.length} waiting` : ''}
          </p>
        </div>
        <UploadControl onUploaded={refresh} />
      </div>

      {view.queue.length > 0 ? (
        <section aria-labelledby={queueHeadingId} className="mt-8">
          <h2 className="type-eyebrow" id={queueHeadingId}>
            Waiting to join
          </h2>
          <ul className="mt-2 border-rule border-b">
            {view.queue.map((garment) => (
              <ReviewCard
                categoryBudgets={categoryBudgets}
                garment={garment}
                key={`${garment.id}-${garment.status}-${garment.studio?.url ?? ''}`}
                onChanged={refresh}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={headingId} className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-rule border-b">
          <div className="flex flex-wrap gap-5" role="tablist">
            {filters.map((entry) => (
              <button
                aria-selected={filter === entry.key}
                className={[
                  tabClass,
                  filter === entry.key ? tabActiveClass : '',
                ].join(' ')}
                key={entry.key}
                onClick={() => setFilter(entry.key)}
                role="tab"
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
          {view.retired.length > 0 ? (
            <label className="inline-flex min-h-11 items-center gap-2 text-ink-muted text-sm">
              <input
                checked={showRetired}
                className="size-4 appearance-none border border-rule-strong checked:bg-ink"
                onChange={(event) => setShowRetired(event.target.checked)}
                type="checkbox"
              />
              Retired
            </label>
          ) : null}
        </div>
        {shown.length === 0 ? (
          <p className="mt-10 max-w-prose text-ink-muted">
            {view.active.length === 0 && !showRetired
              ? 'Nothing here yet. Photograph a garment — on a bed or a floor in ordinary light is fine — and it will be read, named, and rendered for the wardrobe.'
              : 'Nothing matches this filter.'}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shown.map((garment) => (
              <GarmentCell garment={garment} key={garment.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
