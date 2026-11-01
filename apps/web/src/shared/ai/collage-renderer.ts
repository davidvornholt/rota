import { Context, Effect, Layer } from 'effect';
import { env } from '#/shared/env.ts';
import { makeCollageRenderer } from './collage-service.ts';
import { foundryConnection } from './foundry-connection.ts';

export class CollageRenderer extends Context.Service<CollageRenderer>()(
  'shared/CollageRenderer',
  {
    make: foundryConnection(
      env.FOUNDRY_COLLAGE_DEPLOYMENT,
      'Outfit collage',
    ).pipe(Effect.flatMap(makeCollageRenderer)),
  },
) {
  static readonly layer = Layer.effect(CollageRenderer, CollageRenderer.make);
}
