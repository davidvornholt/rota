import { Context, Effect, Layer } from 'effect';
import { env } from '#/shared/env.ts';
import {
  type CollageInput,
  collageFailure,
  requestCollage,
} from './collage-request.ts';
import { CollageError } from './errors/ai-errors.ts';
import { foundryConnection } from './foundry-connection.ts';
import type { StudioConnection } from './studio-request.ts';
import {
  makeStudioScheduler,
  type ReportStudioProgress,
} from './studio-scheduler.ts';

/**
 * Collages run on their own deployment with its own rate limit, so they wait
 * in their own two-slot queue and never hold up a studio render.
 */
export const makeCollageRenderer = (connection: StudioConnection) =>
  Effect.gen(function* () {
    const scheduler = yield* makeStudioScheduler;
    const render = (
      load: Effect.Effect<CollageInput, CollageError>,
      report: ReportStudioProgress,
    ): Effect.Effect<Uint8Array, CollageError> =>
      Effect.gen(function* () {
        // Load the pictures only once a slot is free, then reuse them across retries.
        const input = yield* Effect.cached(
          load.pipe(
            // Another slot may receive a rate limit while the pictures load.
            Effect.tap(() => scheduler.beforeRequest(report)),
          ),
        );
        return yield* scheduler.schedule(
          Effect.flatMap(input, (prepared) =>
            requestCollage(connection, prepared),
          ),
          report,
        );
      }).pipe(
        Effect.catchTag('StudioRenderError', (error) =>
          Effect.fail(
            new CollageError({ message: collageFailure, cause: error }),
          ),
        ),
      );
    return { render };
  });

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
