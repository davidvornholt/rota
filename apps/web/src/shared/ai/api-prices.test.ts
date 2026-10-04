import { expect, it } from 'bun:test';
import { apiPrice } from './api-prices.ts';

const bedrock = {
  provider: 'bedrock',
  model: 'global.anthropic.claude-sonnet-5-5',
} as const;
it('prices the exact global Sonnet profile', () => {
  expect(apiPrice(bedrock)).toBeDefined();
});
it('keeps unknown models and other profiles unpriced', () => {
  expect(apiPrice({ ...bedrock, model: 'unknown' })).toBeUndefined();
  expect(
    apiPrice({ ...bedrock, model: 'eu.anthropic.claude-sonnet-5-5' }),
  ).toBeUndefined();
  expect(apiPrice({ ...bedrock, provider: 'foundry' })).toBeUndefined();
});
it('labels Foundry image estimates as OpenAI reference rates', () => {
  expect(
    apiPrice({ provider: 'foundry', model: 'gpt-image-2.5-flare' })?.basis,
  ).toBe('OpenAI reference rates; Foundry invoice may differ');
});
