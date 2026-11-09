import { Context, Effect, Layer } from 'effect';
import { env } from '#/shared/env.ts';
import {
  claudeClient,
  claudeModel,
  makeGenerateJson,
} from './claude-request.ts';
import { makeUsageLedger } from './usage-ledger.ts';

export class Claude extends Context.Service<Claude>()('shared/Claude', {
  make: Effect.gen(function* () {
    const ledger = yield* makeUsageLedger;
    const client = claudeClient(env.ANTHROPIC_API_KEY);
    const model = claudeModel;
    const generateJson: ReturnType<typeof makeGenerateJson> = (input) =>
      makeGenerateJson(
        (request, signal) =>
          ledger.measure(
            {
              provider: 'anthropic',
              model,
              operation:
                input.purpose === 'outfit'
                  ? 'Outfit suggestion'
                  : 'Garment analysis',
            },
            () => client.beta.messages.create(request, { signal }),
            (answer) => ({
              usage: answer.usage,
              success: answer.stop_reason === 'end_turn',
            }),
          ),
        model,
      )(input);
    return { generateJson, model };
  }),
}) {
  static readonly layer = Layer.effect(Claude, Claude.make);
}
