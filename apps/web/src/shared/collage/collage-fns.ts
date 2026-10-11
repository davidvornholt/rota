import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import { OutfitCollages } from './collage-service.ts';
import { type CollageState, decodeCollageRequest } from './collage-state.ts';

const runtime = featureRuntime('collage', () => OutfitCollages.layer);

/** Answers the outfit's collage, starting it when it has not been made; a POST because asking can start a paid request. */
export const outfitCollageFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeCollageRequest(input))
  .handler(
    ({ data }): Promise<CollageState> =>
      runtime.run(
        Effect.flatMap(OutfitCollages, (collages) =>
          collages.state(data.entries, data.retry),
        ),
      ),
  );
