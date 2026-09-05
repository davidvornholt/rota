import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import { makeStudioRenderer } from './studio-service.ts';

export class StudioRenderer extends Effect.Service<StudioRenderer>()(
  'shared/StudioRenderer',
  {
    effect: makeStudioRenderer({
      endpoint: env.FOUNDRY_OPENAI_ENDPOINT,
      apiKey: env.FOUNDRY_OPENAI_API_KEY,
      deployment: env.FOUNDRY_IMAGE_DEPLOYMENT,
    }),
  },
) {}
