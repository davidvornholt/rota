import { RotaApi } from '@rota/api/api';
import type { Outfit } from '@rota/api/wardrobe';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { asMember } from '#/shared/api/member-runtime.ts';
import { outfitItems } from '#/shared/api/wire.ts';
import { notFound } from '#/shared/data/errors/data-errors.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import { applyOutfitChange } from '../services/planning-service.ts';
import { rotaRuntime } from '../services/rota-runtime.ts';

const toApiOutfit = (
  outfit: SavedOutfit,
  names: ReadonlyMap<string, string>,
): Outfit => ({
  id: outfit.id,
  name: outfit.name,
  items: outfitItems(outfit.entries, names),
  collections: outfit.collections,
  favourite: outfit.favourite,
});

const savedOutfits = Effect.gen(function* () {
  const outfits = yield* OutfitRepository;
  const garments = yield* GarmentRepository;
  const [saved, all] = yield* Effect.all([outfits.list(), garments.list()]);
  const names = new Map(all.map((garment) => [garment.id, garment.name]));
  return saved.map((outfit) => toApiOutfit(outfit, names));
});

const savedOutfit = (id: string) =>
  Effect.gen(function* () {
    const outfit = (yield* savedOutfits).find(
      (candidate) => candidate.id === id,
    );
    return outfit === undefined ? yield* notFound('The outfit') : outfit;
  });

export const outfitsApi = HttpApiBuilder.group(RotaApi, 'outfits', (handlers) =>
  Effect.succeed(
    handlers
      .handle('list', () => asMember(() => rotaRuntime.run(savedOutfits)))
      .handle('save', ({ params, payload }) =>
        asMember(() =>
          rotaRuntime.run(
            Effect.andThen(
              applyOutfitChange({
                action: 'save-outfit',
                id: params.id,
                name: payload.name,
                entries: payload.items,
                collections: payload.collections,
                favourite: payload.favourite,
              }),
              savedOutfit(params.id),
            ),
          ),
        ),
      )
      .handle('favourite', ({ params, payload }) =>
        asMember(() =>
          rotaRuntime.run(
            Effect.andThen(
              applyOutfitChange({
                action: 'favourite-outfit',
                id: params.id,
                favourite: payload.favourite,
              }),
              savedOutfit(params.id),
            ),
          ),
        ),
      )
      .handle('remove', ({ params }) =>
        asMember(() =>
          rotaRuntime.run(
            applyOutfitChange({ action: 'delete-outfit', id: params.id }),
          ),
        ),
      ),
  ),
);
