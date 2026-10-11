import { Context, Effect, Layer } from 'effect';
import { env } from '#/shared/env.ts';
import { foundryConnection } from './foundry-connection.ts';
import { makeStudioRenderer } from './studio-service.ts';

export class StudioRenderer extends Context.Service<StudioRenderer>()(
  'shared/StudioRenderer',
  {
    make: foundryConnection(env.FOUNDRY_IMAGE_DEPLOYMENT, 'Studio render').pipe(
      Effect.flatMap(makeStudioRenderer),
    ),
  },
) {
  static readonly layer = Layer.effect(StudioRenderer, StudioRenderer.make);
}
