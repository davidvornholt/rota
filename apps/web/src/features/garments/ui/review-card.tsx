import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  categoryDefaults,
  type ImageChoice,
  isCategory,
} from '#/shared/data/garment-types.ts';
import { type GarmentView, isRendering } from '#/shared/data/garment-view.ts';
import {
  checkClass,
  linkButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { ConfirmButton } from '#/shared/ui/confirm-button.tsx';
import { EnlargeableFigure } from '#/shared/ui/enlargeable-figure.tsx';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import {
  acceptGarmentFn,
  deleteGarmentFn,
  reprocessGarmentFn,
  retryStudioFn,
} from '../services/garments-fns.ts';
import { editOf } from './garment-edit.ts';
import { GarmentForm } from './garment-form.tsx';

type ReviewCardProps = {
  readonly garment: GarmentView;
  readonly categoryBudgets: Readonly<Record<string, number>>;
  readonly onChanged: () => void;
};

const choiceLabel = (
  kind: ImageChoice,
  present: boolean,
  rendering: boolean,
): string => {
  if (kind === 'original') {
    return 'Photo';
  }
  if (present) {
    return 'Studio';
  }
  return rendering ? 'Studio · rendering …' : 'Studio · failed';
};

/**
 * The two pictures side by side; pressing one shows it large, the radio under
 * it says which the wardrobe keeps. The chosen picture wears an ink border.
 */
const ImageChoiceControl = ({
  garment,
  choice,
  onChoose,
}: {
  readonly garment: GarmentView;
  readonly choice: ImageChoice;
  readonly onChoose: (choice: ImageChoice) => void;
}) => (
  <fieldset>
    <legend className="type-eyebrow">Picture</legend>
    <div className="mt-2 grid grid-cols-2 gap-3">
      {(['studio', 'original'] as const).map((kind) => {
        const image = kind === 'studio' ? garment.studio : garment.original;
        const selected = choice === kind;
        return (
          <div key={kind}>
            <div
              className={[
                'border p-1 transition-colors',
                selected ? 'border-ink' : 'border-transparent',
                image === undefined ? 'opacity-50' : '',
              ].join(' ')}
            >
              <EnlargeableFigure
                caption={kind === 'studio' ? 'Studio render' : 'Photo'}
                colors={garment.colors}
                image={image}
                name={garment.name}
              />
            </div>
            <label className="mt-1 flex min-h-11 cursor-pointer items-center justify-center gap-2 text-ink-muted text-xs">
              <input
                checked={selected}
                className={checkClass}
                disabled={image === undefined}
                name={`image-choice-${garment.id}`}
                onChange={() => onChoose(kind)}
                type="radio"
                value={kind}
              />
              {choiceLabel(kind, image !== undefined, isRendering(garment))}
            </label>
          </div>
        );
      })}
    </div>
  </fieldset>
);

const ProcessingCard = ({ garment }: { readonly garment: GarmentView }) => (
  <li className="grid gap-4 border-rule border-t py-5 sm:grid-cols-[10rem_1fr] sm:gap-6">
    <GarmentFigure alt="" image={garment.original} name="New garment" />
    <div>
      <p className="type-eyebrow">Reading</p>
      <p className="type-display mt-1 text-2xl text-ink" role="status">
        Looking at the photo …
      </p>
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        The garment is being named and measured, then photographed flat for the
        wardrobe. The card fills in as it lands.
      </p>
    </div>
  </li>
);

const failureMessage = (error: unknown) =>
  error instanceof Error && error.message !== ''
    ? error.message
    : 'The garment could not be saved. Check the fields and try again.';

/**
 * A garment waiting to join the wardrobe. The model's reading is on the card
 * already; one tap accepts it, or the fields are corrected first. While the
 * picture is still being read the card shows the photo and says so.
 */
export const ReviewCard = ({
  garment,
  categoryBudgets,
  onChanged,
}: ReviewCardProps) => {
  const [edit, setEdit] = useState(() => editOf(garment));
  const [choice, setChoice] = useState<ImageChoice>(
    garment.studio === undefined ? 'original' : 'studio',
  );
  const accept = useMutation({
    mutationFn: () =>
      acceptGarmentFn({ data: { id: garment.id, edit, imageChoice: choice } }),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => deleteGarmentFn({ data: { id: garment.id } }),
    onSuccess: onChanged,
  });
  const reprocess = useMutation({
    mutationFn: () => reprocessGarmentFn({ data: { id: garment.id } }),
    onSuccess: onChanged,
  });
  const retryStudio = useMutation({
    mutationFn: () => retryStudioFn({ data: { id: garment.id } }),
    onSuccess: onChanged,
  });

  if (garment.status === 'processing') {
    return <ProcessingCard garment={garment} />;
  }

  const categoryBudget =
    categoryBudgets[edit.category] ??
    (isCategory(edit.category) ? categoryDefaults[edit.category].budget : 2);

  return (
    <li className="grid gap-6 border-rule border-t py-6 lg:grid-cols-[18rem_1fr] lg:gap-10">
      <div className="grid gap-4">
        <ImageChoiceControl
          choice={choice}
          garment={garment}
          onChoose={setChoice}
        />
        {garment.processingError === null ? null : (
          <Notice>Part of the reading failed: {garment.processingError}</Notice>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {garment.studio === undefined && !isRendering(garment) ? (
            <button
              aria-busy={retryStudio.isPending}
              className={linkButtonClass}
              disabled={retryStudio.isPending}
              onClick={() => retryStudio.mutate()}
              type="button"
            >
              Render the studio picture
            </button>
          ) : null}
          <button
            aria-busy={reprocess.isPending}
            className={linkButtonClass}
            disabled={reprocess.isPending}
            onClick={() => reprocess.mutate()}
            type="button"
          >
            Read the photo again
          </button>
        </div>
      </div>
      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          accept.mutate();
        }}
      >
        <GarmentForm
          categoryBudget={categoryBudget}
          compact={true}
          onChange={setEdit}
          value={edit}
        />
        {accept.isError ? (
          <Notice live={true}>{failureMessage(accept.error)}</Notice>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            aria-busy={accept.isPending}
            className={signalButtonClass}
            disabled={accept.isPending || edit.slots.length === 0}
            type="submit"
          >
            {accept.isPending ? 'Adding …' : 'Add to wardrobe'}
          </button>
          <ConfirmButton
            confirmLabel="Discard photo and reading"
            label="Discard"
            onConfirm={() => remove.mutate()}
            pending={remove.isPending}
          />
        </div>
      </form>
    </li>
  );
};
