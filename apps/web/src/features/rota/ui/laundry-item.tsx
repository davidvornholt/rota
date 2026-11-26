import type { ReactNode } from 'react';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';

/** One row of a laundry list: the piece, a line about its state, and its action. */
export const LaundryItem = ({
  garment,
  status,
  children,
}: {
  readonly garment: GarmentView;
  readonly status: string;
  readonly children: ReactNode;
}) => (
  <li className="flex items-center gap-4 py-4">
    <GarmentFigure
      alt=""
      className="w-16 shrink-0 sm:w-20"
      colors={garment.colors}
      image={garment.image}
      name={garment.name}
      sizes="(min-width: 640px) 5rem, 4rem"
    />
    <span className="min-w-0 flex-1 break-words">
      {garment.name}
      <span className="mt-1 block text-ink-muted text-xs">{status}</span>
    </span>
    {children}
  </li>
);
