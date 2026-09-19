import type { TokenPrices } from './usage-cost.ts';

const vertexSource =
  'https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing';
const regularPricingStarts = new Date('2027-01-01T00:00:00Z');
const checkedOn = '2026-09-19';

const vertexRates = {
  introductory: {
    global: { input: 0.75, output: 3.75, cachedInput: 0.075 },
    regional: { input: 0.825, output: 4.125, cachedInput: 0.0825 },
  },
  regular: {
    global: { input: 1.5, output: 7.5, cachedInput: 0.15 },
    regional: { input: 1.65, output: 8.25, cachedInput: 0.165 },
  },
} as const;

export type PriceSnapshot = TokenPrices & {
  readonly source: string;
  readonly checkedOn: string;
  readonly basis: string;
};

/** USD per million tokens for standard on-demand requests, excluding contracts and tax. */
export const apiPrice = ({
  provider,
  model,
  location,
  at,
}: {
  readonly provider: 'vertex' | 'foundry';
  readonly model: string;
  readonly location: string;
  readonly at: Date;
}): PriceSnapshot | undefined => {
  if (provider === 'foundry' && model === 'gpt-image-2.5-flare') {
    // Foundry has not published these rates yet. This is an explicitly labelled
    // OpenAI reference estimate, not an assertion about Azure billing.
    return {
      input: 5,
      output: 0,
      imageInput: 8,
      imageOutput: 30,
      cachedInput: 0,
      source:
        'https://developers.openai.com/api/docs/models/gpt-image-2.5-flare',
      checkedOn,
      basis: 'OpenAI reference rates; Foundry invoice may differ',
    };
  }
  if (provider !== 'vertex' || model !== 'gemini-3.8-flash') {
    return undefined;
  }
  // Google publishes the introductory rate through December 31, then doubles it.
  const period = at >= regularPricingStarts ? 'regular' : 'introductory';
  const region = location === 'global' ? 'global' : 'regional';
  const rates = vertexRates[period][region];
  return {
    ...rates,
    imageInput: rates.input,
    imageOutput: 0,
    source: vertexSource,
    checkedOn,
    basis: `Vertex standard ${region} ${period} pricing`,
  };
};
