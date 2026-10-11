import { Context, Effect, Layer } from 'effect';
import { CollageRenderer } from '#/shared/ai/collage-renderer.ts';
import { CollageRepository } from '#/shared/data/collage-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { makeOutfitCollages } from './outfit-collages.ts';

export class OutfitCollages extends Context.Service<OutfitCollages>()(
  'shared/OutfitCollages',
  {
    make: Effect.gen(function* () {
      return makeOutfitCollages({
        garments: yield* GarmentRepository,
        collages: yield* CollageRepository,
        media: yield* MediaStore,
        renderer: yield* CollageRenderer,
      });
    }),
  },
) {
  static readonly layer = Layer.effect(OutfitCollages, OutfitCollages.make);
}
