import type { TokenPrices } from './usage-cost.ts';

/** Foundry image models priced at OpenAI's reference rates, with the day each was checked. */
const imageRatesCheckedOn: Readonly<Record<string, string>> = {
  'gpt-image-2.5-flare': '2026-09-19',
  'gpt-image-2.5-sunburst': '2026-10-11',
};

export type PriceSnapshot = TokenPrices & {
  readonly source: string;
  readonly checkedOn: string;
  readonly basis: string;
};

/** USD per million tokens for standard on-demand requests, excluding contracts and tax. */
export const apiPrice = ({
  provider,
  model,
}: {
  readonly provider: 'bedrock' | 'foundry';
  readonly model: string;
}): PriceSnapshot | undefined => {
  const imageCheckedOn =
    provider === 'foundry' ? imageRatesCheckedOn[model] : undefined;
  if (imageCheckedOn !== undefined) {
    // Foundry has not published these rates yet. This is an explicitly labelled
    // OpenAI reference estimate, not an assertion about Azure billing. Flare and
    // Sunburst have the same rates.
    return {
      input: 5,
      output: 0,
      imageInput: 8,
      imageOutput: 30,
      cachedInput: 0,
      source: `https://developers.openai.com/api/docs/models/${model}`,
      checkedOn: imageCheckedOn,
      basis: 'OpenAI reference rates; Foundry invoice may differ',
    };
  }
  if (
    provider !== 'bedrock' ||
    model !== 'global.anthropic.claude-sonnet-5-5'
  ) {
    return undefined;
  }
  return {
    input: 2,
    output: 10,
    imageInput: 2,
    imageOutput: 0,
    cachedInput: 0.2,
    source: 'https://platform.claude.com/docs/en/about-claude/pricing',
    checkedOn: '2026-10-01',
    basis: 'Bedrock standard global pricing; no prompt cache writes',
  };
};
