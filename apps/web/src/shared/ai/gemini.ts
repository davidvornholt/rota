import { GoogleGenAI } from '@google/genai';
import { Effect } from 'effect';
import { env } from '#/shared/env.ts';
import { makeGenerateJson } from './gemini-request.ts';

export class Gemini extends Effect.Service<Gemini>()('shared/Gemini', {
  sync: () => {
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

    const generateJson = makeGenerateJson(client.models, model);
    return { generateJson, model };
  },
}) {}
