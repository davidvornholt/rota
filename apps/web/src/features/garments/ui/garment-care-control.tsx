import { hasWearBudget } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { formatDayMonth } from '#/shared/time/local-date.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';

export const GarmentCareControl = ({
  garment,
  onCare,
  pending,
  disabled,
}: {
  readonly garment: GarmentView;
  readonly onCare: (action: 'laundry' | 'washed') => void;
  readonly pending: boolean;
  readonly disabled: boolean;
}) =>
  hasWearBudget(garment) ? (
    <div className="flex items-center gap-2">
      <IconButton
        icon={garment.inLaundry ? 'check' : 'laundry'}
        label={garment.inLaundry ? 'Back clean' : 'Send to laundry'}
        onClick={() => onCare(garment.inLaundry ? 'washed' : 'laundry')}
        pending={pending}
        disabled={disabled}
      />
      {garment.inLaundry ? (
        <span className="text-ink-muted text-xs" role="status">
          In laundry
          {garment.readyOn === null
            ? ''
            : ` · back ${formatDayMonth(garment.readyOn)}`}
        </span>
      ) : null}
    </div>
  ) : null;
