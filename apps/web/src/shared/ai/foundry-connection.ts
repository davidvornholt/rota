import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import type { StudioConnection } from './studio-request.ts';
import { makeUsageLedger } from './usage-ledger.ts';

/**
 * A connection to one Foundry image deployment. Every request lands in the
 * usage ledger under `operation`, with the usage the answer reports.
 */
export const foundryConnection = (deployment: string, operation: string) =>
  Effect.gen(function* () {
    const ledger = yield* makeUsageLedger;
    const connection: StudioConnection = {
      endpoint: env.FOUNDRY_OPENAI_ENDPOINT,
      apiKey: env.FOUNDRY_OPENAI_API_KEY,
      deployment,
      request: (url, init) =>
        ledger
          .measure(
            { provider: 'foundry', model: deployment, operation },
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
    };
    return connection;
  });
