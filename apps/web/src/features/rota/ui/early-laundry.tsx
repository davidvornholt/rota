import type { GarmentView } from '#/shared/data/garment-view.ts';
import { quietButtonClass } from '#/shared/ui/classes.ts';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';

export const EarlyLaundry = ({
  selected,
  disabled,
  onChoose,
  onSend,
}: {
  readonly selected: GarmentView | undefined;
  readonly disabled: boolean;
  readonly onChoose: () => void;
  readonly onSend: () => void;
}) => (
  <details className="mt-5 border-rule border-t pt-4">
    <summary className="cursor-pointer py-2 text-sm">
      Send a piece to laundry early
    </summary>
    {selected === undefined ? null : (
      <figure className="mt-3 flex items-center gap-4">
        <GarmentFigure
          className="w-24 shrink-0"
          image={selected.image}
          name={selected.name}
          colors={selected.colors}
        />
        <figcaption className="type-display text-xl">
          {selected.name}
        </figcaption>
      </figure>
    )}
    <form
      className="mt-3 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <button
        aria-haspopup="dialog"
        className={quietButtonClass}
        disabled={disabled}
        onClick={onChoose}
        type="button"
      >
        {selected === undefined ? 'Choose a piece' : 'Change piece'}
      </button>
      <button
        className={quietButtonClass}
        type="submit"
        disabled={disabled || selected === undefined}
      >
        Put in basket
      </button>
    </form>
  </details>
);
