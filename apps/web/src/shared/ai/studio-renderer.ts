import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import { makeStudioRenderer } from './studio-service.ts';
import { makeUsageLedger } from './usage-ledger.ts';

export class StudioRenderer extends Effect.Service<StudioRenderer>()(
  'shared/StudioRenderer',
  {
    effect: Effect.gen(function* () {
      const ledger = yield* makeUsageLedger;
      return yield* makeStudioRenderer({
        endpoint: env.FOUNDRY_OPENAI_ENDPOINT,
        apiKey: env.FOUNDRY_OPENAI_API_KEY,
        deployment: env.FOUNDRY_IMAGE_DEPLOYMENT,
        request: (url, init) =>
          ledger
            .measure(
              {
                provider: 'foundry',
                model: env.FOUNDRY_IMAGE_DEPLOYMENT,
                operation: 'Studio render',
              },
              async () => {
                const response = await fetch(url, init);
                if (!response.ok) {
                  return { response, usage: null };
                }
                const body = (await response.clone().json()) as {
                  usage?: unknown;
                };
                return { response, usage: body.usage };
              },
              (result) => ({
                usage: result.usage ?? null,
                success: result.response.ok,
              }),
            )
            .then((result) => result.response),
      });
    }),
  },
) {}
