import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CollageEntry,
  collageGarments,
} from '#/shared/collage/collage-entries.ts';
import { outfitCollageFn } from '#/shared/collage/collage-fns.ts';
import type { CollageState } from '#/shared/collage/collage-state.ts';

const pollInterval = 3000;

export type OutfitCollageQuery = {
  /** Undefined while the first answer is on its way. */
  readonly state: CollageState | undefined;
  /** The server could not be asked; `retry` asks again. */
  readonly unavailable: boolean;
  /** Asks again after `unavailable`, or makes a new attempt after a failed picture. */
  readonly retry: () => void;
  readonly retrying: boolean;
};

/**
 * The outfit's collage, shared by every place that shows the same pieces. The
 * first ask starts the picture; while it is being made the page asks again
 * every few seconds.
 */
export const useOutfitCollage = (
  entries: ReadonlyArray<CollageEntry>,
): OutfitCollageQuery => {
  const garments = collageGarments(entries);
  const request = garments.map(({ slot, garment }) => ({
    slot,
    garmentId: garment.id,
  }));
  // The picture URL names the stored picture, so another picture of a garment is another collage.
  const queryKey = [
    'outfit-collage',
    ...garments.map(({ slot, garment }) => `${slot}:${garment.image.url}`),
  ];
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () =>
      outfitCollageFn({ data: { entries: request, retry: false } }),
    enabled: garments.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (current) =>
      current.state.data?.status === 'pending' ? pollInterval : false,
  });
  const attempt = useMutation({
    mutationFn: () =>
      outfitCollageFn({ data: { entries: request, retry: true } }),
    onSuccess: (state) => queryClient.setQueryData(queryKey, state),
  });
  const unavailable =
    (query.isError && query.data === undefined) || attempt.isError;
  return {
    state: garments.length === 0 ? { status: 'empty' } : query.data,
    unavailable,
    retry: () => {
      if (query.isError && query.data === undefined) {
        query.refetch().catch(() => undefined);
        return;
      }
      attempt.mutate();
    },
    retrying: attempt.isPending || (query.isFetching && unavailable),
  };
};
