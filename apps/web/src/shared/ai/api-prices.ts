import type { TokenPrices } from './usage-cost.ts';

const checkedOn = '2026-09-19';

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
