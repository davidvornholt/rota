import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ImageChoice } from '#/shared/data/garment-types.ts';
import { type GarmentView, isRendering } from '#/shared/data/garment-view.ts';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import {
  deleteGarmentFn,
  restoreGarmentFn,
  retireGarmentFn,
  setGarmentCareFn,
  setImageChoiceFn,
  updateGarmentFn,
} from '../services/garments-fns.ts';
import { requestStudioRender } from '../services/studio-request.ts';
import { editOf } from './garment-edit.ts';
import { replacePhoto } from './replace-photo.ts';
import { useGarmentPolling } from './use-garment-polling.ts';

export const useGarmentDetail = (initial: GarmentView) => {
  const router = useRouter();
  const [garment, setGarment] = useState(initial);
  const [edit, setEdit] = useState<GarmentEdit>(() => editOf(initial));
  const [saved, setSaved] = useState(false);
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
  // Only the picture changed on the server; unsaved edits in the form stay.
  const replace = useMutation({
    mutationFn: (file: File) => replacePhoto({ id, file }),
    onSuccess: (next) => {
      setGarment(next);
      router.invalidate().catch(() => undefined);
    },
  });
  const care = useMutation({
    mutationFn: (action: 'laundry' | 'washed') =>
      setGarmentCareFn({
        data: { id, care: action },
        fetch: serverFunctionFetch,
      }),
    onSuccess: (next) => {
      setGarment(next);
      router.invalidate().catch(() => undefined);
    },
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
  const [instructions, setInstructions] = useState('');
  const retryStudio = useMutation({
    mutationFn: () => requestStudioRender({ id, edit, instructions }),
    onSuccess: apply,
  });

  useGarmentPolling(isRendering(garment) || retryStudio.isPending);

  const mutations = [save, choose, care, retire, restore, remove];
  const failure = mutations.find((mutation) => mutation.isError)?.error;
  const lifecyclePending =
    retryStudio.isPending ||
    replace.isPending ||
    isRendering(garment) ||
    mutations.some((mutation) => mutation.isPending);

  return {
    garment,
    edit,
    setEdit,
    saved,
    setSaved,
    save,
    choose,
    care,
    replace,
    retire,
    restore,
    remove,
    instructions,
    setInstructions,
    retryStudio,
    failure,
    lifecyclePending,
  };
};
