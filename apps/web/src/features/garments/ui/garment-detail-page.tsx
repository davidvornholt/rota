import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
  categoryDefaults,
  type ImageChoice,
  isCategory,
  slotLabel,
} from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { formatDayMonth } from '#/shared/time/local-date.ts';
import {
  frameClass,
  inkButtonClass,
  linkButtonClass,
  quietButtonClass,
} from '#/shared/ui/classes.ts';
import { ConfirmButton } from '#/shared/ui/confirm-button.tsx';
import { EnlargeableFigure } from '#/shared/ui/enlargeable-figure.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { GarmentForm } from './garment-form.tsx';
import { StudioRenderControl } from './studio-render-control.tsx';
import { useGarmentDetail } from './use-garment-detail.ts';

const Fact = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="border-rule border-t py-3">
    <dt className="type-eyebrow">{label}</dt>
    <dd className="type-display mt-1 text-2xl text-ink">{value}</dd>
  </div>
);

const failureMessage = (error: unknown) =>
  error instanceof Error && error.message !== ''
    ? error.message
    : 'That did not go through. Try again.';

type PictureProps = {
  readonly garment: GarmentView;
  readonly onChoose: (choice: ImageChoice) => void;
  readonly choosing: boolean;
  readonly renderControl: ReactNode;
};

/** The picture and the facts beside it; sticky on wide screens while the form scrolls. */
const Picture = ({
  garment,
  onChoose,
  choosing,
  renderControl,
}: PictureProps) => (
  <div className="lg:sticky lg:top-8">
    <EnlargeableFigure
      caption={garment.imageChoice === 'studio' ? 'Studio render' : 'Photo'}
      colors={garment.colors}
      image={garment.image}
      loading="eager"
      name={garment.name}
    />
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
      {garment.studio !== undefined && garment.original !== undefined ? (
        <button
          aria-busy={choosing}
          className={linkButtonClass}
          disabled={choosing}
          onClick={() =>
            onChoose(garment.imageChoice === 'studio' ? 'original' : 'studio')
          }
          type="button"
        >
          {garment.imageChoice === 'studio'
            ? 'Show the photo instead'
            : 'Show the studio picture'}
        </button>
      ) : null}
    </div>
    {renderControl}
    <dl className="mt-6 grid grid-cols-2 gap-x-6 border-rule border-b">
      <Fact
        label="Worn"
        value={garment.wears === 0 ? 'Never' : `${garment.wears}×`}
      />
      <Fact
        label="Last worn"
        value={
          garment.lastWornOn === null ? '—' : formatDayMonth(garment.lastWornOn)
        }
      />
      <Fact label="Days in a row" value={String(garment.effectiveBudget)} />
      <Fact
        label="Cost per wear"
        value={
          garment.costPerWear === null
            ? '—'
            : `€${garment.costPerWear.toFixed(2)}`
        }
      />
    </dl>
  </div>
);

type LifecycleProps = {
  readonly garment: GarmentView;
  readonly onRetire: () => void;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
  readonly pending: boolean;
};

/** Retire, bring back, delete: the actions that change what the garment is. */
const Lifecycle = ({
  garment,
  onRetire,
  onRestore,
  onDelete,
  pending,
}: LifecycleProps) => (
  <div className="mt-10 flex flex-wrap items-center gap-3 border-rule border-t pt-6">
    {garment.status === 'retired' ? (
      <button
        aria-busy={pending}
        className={quietButtonClass}
        disabled={pending}
        onClick={onRestore}
        type="button"
      >
        Bring back into rotation
      </button>
    ) : (
      <button
        aria-busy={pending}
        className={quietButtonClass}
        disabled={pending}
        onClick={onRetire}
        type="button"
      >
        Retire from rotation
      </button>
    )}
    <ConfirmButton
      confirmLabel="Delete for good"
      disabled={garment.wears > 0}
      label="Delete"
      onConfirm={onDelete}
      pending={pending}
      title={
        garment.wears > 0
          ? 'A garment with wear history is retired, not deleted.'
          : undefined
      }
      tone="link"
    />
  </div>
);

/** One garment: its picture, its facts, and every field open to correction. */
export const GarmentDetailPage = ({
  initial,
  categoryBudgets,
}: {
  readonly initial: GarmentView;
  readonly categoryBudgets: Readonly<Record<string, number>>;
}) => {
  const {
    garment,
    edit,
    setEdit,
    saved,
    setSaved,
    save,
    choose,
    retire,
    restore,
    remove,
    instructions,
    setInstructions,
    retryStudio,
    failure,
    lifecyclePending,
  } = useGarmentDetail(initial);
  const categoryBudget =
    categoryBudgets[edit.category] ??
    (isCategory(edit.category) ? categoryDefaults[edit.category].budget : 2);
  return (
    <div className={frameClass}>
      <p className="type-eyebrow">
        <Link className="hover:text-ink" to="/wardrobe">
          Wardrobe
        </Link>
        <span> / </span>
        {garment.slots.map((slot) => slotLabel[slot]).join(', ')}
        {garment.status === 'retired' ? ' · retired' : ''}
      </p>
      <div className="mt-2 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <Picture
            choosing={lifecyclePending}
            garment={garment}
            onChoose={(choice) => choose.mutate(choice)}
            renderControl={
              <StudioRenderControl
                context="wardrobe"
                garment={garment}
                instructions={instructions}
                onInstructionsChange={setInstructions}
                onRender={() => {
                  setSaved(false);
                  retryStudio.mutate();
                }}
                pending={retryStudio.isPending}
                disabled={
                  lifecyclePending ||
                  edit.colors.length === 0 ||
                  edit.slots.length === 0
                }
                error={retryStudio.error}
                complete={retryStudio.isSuccess}
              />
            }
          />
        </div>
        <div className="lg:col-span-7">
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);
              save.mutate();
            }}
          >
            <fieldset className="grid gap-6" disabled={retryStudio.isPending}>
              <GarmentForm
                categoryBudget={categoryBudget}
                onChange={(next) => {
                  setSaved(false);
                  setEdit(next);
                }}
                value={edit}
              />
            </fieldset>
            {failure === undefined ? null : (
              <Notice live={true}>{failureMessage(failure)}</Notice>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                aria-busy={save.isPending}
                className={inkButtonClass}
                disabled={
                  lifecyclePending ||
                  edit.slots.length === 0 ||
                  edit.colors.length === 0
                }
                type="submit"
              >
                {save.isPending ? 'Saving …' : 'Save changes'}
              </button>
              {saved ? (
                <span className="text-ink-muted text-sm" role="status">
                  Saved
                </span>
              ) : null}
            </div>
          </form>
          <Lifecycle
            garment={garment}
            onDelete={() => remove.mutate()}
            onRestore={() => restore.mutate()}
            onRetire={() => retire.mutate()}
            pending={lifecyclePending}
          />
        </div>
      </div>
    </div>
  );
};
