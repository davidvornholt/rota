import type { GarmentView } from '#/shared/data/garment-view.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { LaundryItem } from './laundry-item.tsx';
import { wearsStatus } from './laundry-lists.ts';

/** Pieces worn since their last wash, each with a way to put it in the basket now. */
export const WornSinceWashing = ({
  garments,
  disabled,
  onBasket,
}: {
  readonly garments: ReadonlyArray<GarmentView>;
  readonly disabled: boolean;
  readonly onBasket: (id: string) => void;
}) =>
  garments.length === 0 ? null : (
    <section className="mt-6" aria-label="Worn since washing">
      <h2 className="type-eyebrow">Worn since washing</h2>
      <ul className="mt-2 divide-y divide-rule">
        {garments.map((garment) => (
          <LaundryItem
            key={garment.id}
            garment={garment}
            status={wearsStatus(garment)}
          >
            <IconButton
              icon="laundry"
              label={`Put in basket: ${garment.name}`}
              disabled={disabled}
              onClick={() => onBasket(garment.id)}
            />
          </LaundryItem>
        ))}
      </ul>
    </section>
  );
