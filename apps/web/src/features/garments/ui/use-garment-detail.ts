import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ImageChoice } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import {
  deleteGarmentFn,
  reprocessGarmentFn,
  restoreGarmentFn,
  retireGarmentFn,
  setImageChoiceFn,
  updateGarmentFn,
} from '../services/garments-fns.ts';
import { requestStudioRender } from '../services/studio-request.ts';
import { editOf } from './garment-edit.ts';

export const useGarmentDetail = (initial: GarmentView) => {
  const router = useRouter();
  const [garment, setGarment] = useState(initial);
  const [edit, setEdit] = useState<GarmentEdit>(() => editOf(initial));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setGarment(initial);
    setEdit(editOf(initial));
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
  const [instructions, setInstructions] = useState('');
  const retryStudio = useMutation({
    mutationFn: () => requestStudioRender({ id, edit, instructions }),
    onSuccess: apply,
  });

  const mutations = [save, choose, retire, restore, remove, reprocess];
  const failure = mutations.find((mutation) => mutation.isError)?.error;
  const lifecyclePending =
    retryStudio.isPending || mutations.some((mutation) => mutation.isPending);

  return {
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
    reprocess,
    instructions,
    setInstructions,
    retryStudio,
    failure,
    lifecyclePending,
  };
};
