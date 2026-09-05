import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
  categoryDefaults,
  type ImageChoice,
  isCategory,
  slotLabel,
} from '#/shared/data/garment-types.ts';
import { type GarmentView, isRendering } from '#/shared/data/garment-view.ts';
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
import type { GarmentEdit } from '../schemas/garment-input.ts';
import {
  deleteGarmentFn,
  reprocessGarmentFn,
  restoreGarmentFn,
  retireGarmentFn,
  retryStudioFn,
  setImageChoiceFn,
  updateGarmentFn,
} from '../services/garments-fns.ts';
import { editOf } from './garment-edit.ts';
import { GarmentForm } from './garment-form.tsx';
import { StudioControl } from './studio-control.tsx';
import { useGarmentPolling } from './use-garment-polling.ts';

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
  readonly onRender: () => void;
  readonly rendering: boolean;
};

/** The picture and the facts beside it; sticky on wide screens while the form scrolls. */
const Picture = ({
  garment,
  onChoose,
  choosing,
  onRender,
  rendering,
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
      <StudioControl
        garment={garment}
        pending={rendering}
        onRender={onRender}
      />
    </div>
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
  readonly onReprocess: () => void;
  readonly onDelete: () => void;
  readonly pending: boolean;
};

/** Retire, bring back, re-read, delete: the actions that change what the garment is. */
const Lifecycle = ({
  garment,
  onRetire,
  onRestore,
  onReprocess,
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
      confirmLabel="Replace the fields with a new reading"
      label="Read the photo again"
      onConfirm={onReprocess}
      pending={pending}
      tone="link"
    />
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
  const router = useRouter();
  const [garment, setGarment] = useState(initial);
  const [edit, setEdit] = useState<GarmentEdit>(() => editOf(initial));
  const [saved, setSaved] = useState(false);
  useGarmentPolling(isRendering(garment));
  useEffect(() => {
    setGarment(initial);
  }, [initial]);

  const apply = (next: GarmentView) => {
    setGarment(next);
    setEdit(editOf(next));
    router.invalidate().catch(() => undefined);
  };
  const { id } = garment;
  const save = useMutation({
    mutationFn: () => updateGarmentFn({ data: { id, edit } }),
    onSuccess: (next) => {
      setSaved(true);
      apply(next);
    },
  });
  const choose = useMutation({
    mutationFn: (imageChoice: ImageChoice) =>
      setImageChoiceFn({ data: { id, imageChoice } }),
    onSuccess: apply,
  });
  const retire = useMutation({
    mutationFn: () => retireGarmentFn({ data: { id } }),
    onSuccess: apply,
  });
  const restore = useMutation({
    mutationFn: () => restoreGarmentFn({ data: { id } }),
    onSuccess: apply,
  });
  const leave = () => router.navigate({ to: '/wardrobe' });
  const remove = useMutation({
    mutationFn: () => deleteGarmentFn({ data: { id } }),
    onSuccess: leave,
  });
  const reprocess = useMutation({
    mutationFn: () => reprocessGarmentFn({ data: { id } }),
    onSuccess: leave,
  });
  const retryStudio = useMutation({
    mutationFn: () => retryStudioFn({ data: { id } }),
    onSuccess: () => router.invalidate(),
  });

  const categoryBudget =
    categoryBudgets[edit.category] ??
    (isCategory(edit.category) ? categoryDefaults[edit.category].budget : 2);
  const mutations = [
    save,
    choose,
    retire,
    restore,
    remove,
    reprocess,
    retryStudio,
  ];
  const failure = mutations.find((mutation) => mutation.isError)?.error;
  const lifecyclePending = mutations.some((mutation) => mutation.isPending);

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
            choosing={choose.isPending}
            garment={garment}
            onChoose={(choice) => choose.mutate(choice)}
            onRender={() => retryStudio.mutate()}
            rendering={retryStudio.isPending}
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
            <GarmentForm
              categoryBudget={categoryBudget}
              onChange={(next) => {
                setSaved(false);
                setEdit(next);
              }}
              value={edit}
            />
            {failure === undefined ? null : (
              <Notice live={true}>{failureMessage(failure)}</Notice>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                aria-busy={save.isPending}
                className={inkButtonClass}
                disabled={save.isPending || edit.slots.length === 0}
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
            onReprocess={() => reprocess.mutate()}
            onRestore={() => restore.mutate()}
            onRetire={() => retire.mutate()}
            pending={lifecyclePending || isRendering(garment)}
          />
        </div>
      </div>
    </div>
  );
};
