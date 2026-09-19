import { GoogleGenAI } from '@google/genai';
import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import { makeGenerateJson } from './gemini-request.ts';
import { makeUsageLedger } from './usage-ledger.ts';

export class Gemini extends Effect.Service<Gemini>()('shared/Gemini', {
  effect: Effect.gen(function* () {
    const ledger = yield* makeUsageLedger;
    const client = new GoogleGenAI({
      vertexai: true,
      project: env.GOOGLE_VERTEX_PROJECT,
      location: env.GOOGLE_VERTEX_LOCATION,
      googleAuthOptions: {
        credentials: JSON.parse(env.GOOGLE_VERTEX_CREDENTIALS_JSON) as Record<
          string,
          unknown
        >,
      },
    });
    const model = env.GEMINI_MODEL;

    const generateJson: ReturnType<typeof makeGenerateJson> = (input) =>
      makeGenerateJson(
        {
          generateContent: (params) =>
            ledger.measure(
              {
                provider: 'vertex',
                model,
                operation:
                  input.purpose === 'outfit'
                    ? 'Outfit suggestion'
                    : 'Garment analysis',
              },
              () => client.models.generateContent(params),
              (answer) => ({
                usage: answer.usageMetadata ?? null,
                success: true,
              }),
            ),
        },
        model,
      )(input);
    return { generateJson, model };
  }),
}) {}
