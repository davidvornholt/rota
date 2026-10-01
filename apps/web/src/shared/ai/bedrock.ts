import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import { makeGenerateJson } from './bedrock-request.ts';
import { makeUsageLedger } from './usage-ledger.ts';

export class Bedrock extends Effect.Service<Bedrock>()('shared/Bedrock', {
  effect: Effect.gen(function* () {
    const ledger = yield* makeUsageLedger;
    const client = new BedrockRuntimeClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      // Effect owns the bounded retries so each billed attempt has its own ledger row.
      maxAttempts: 1,
    });
    const model = env.BEDROCK_MODEL;
    const generateJson: ReturnType<typeof makeGenerateJson> = (input) =>
      makeGenerateJson(
        (request, signal) =>
          ledger.measure(
            {
              provider: 'bedrock',
              model,
              operation:
                input.purpose === 'outfit'
                  ? 'Outfit suggestion'
                  : 'Garment analysis',
            },
            () =>
              client.send(new ConverseCommand(request), {
                abortSignal: signal,
              }),
            (answer) => ({
              usage: answer.usage ?? null,
              success: answer.stopReason === 'end_turn',
            }),
          ),
        model,
      )(input);
    return { generateJson, model };
  }),
}) {}
