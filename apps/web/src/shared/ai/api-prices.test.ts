import { expect, it } from 'bun:test';
import { apiPrice } from './api-prices.ts';

const bedrock = {
  provider: 'bedrock',
  model: 'global.anthropic.claude-sonnet-5-5',
} as const;
it('prices the exact global Sonnet profile at standard rates', () => {
  expect(apiPrice(bedrock)).toMatchObject({
    input: 2,
    output: 10,
    imageInput: 2,
    cachedInput: 0.2,
    checkedOn: '2026-10-01',
  });
});
it('keeps unknown models and other profiles unpriced', () => {
  expect(apiPrice({ ...bedrock, model: 'unknown' })).toBeUndefined();
  expect(
    apiPrice({ ...bedrock, model: 'eu.anthropic.claude-sonnet-5-5' }),
  ).toBeUndefined();
  expect(apiPrice({ ...bedrock, provider: 'foundry' })).toBeUndefined();
});
it('labels Foundry image estimates with their actual OpenAI reference source', () => {
  expect(
    apiPrice({ provider: 'foundry', model: 'gpt-image-2.5-flare' }),
  ).toMatchObject({
    input: 5,
    imageInput: 8,
    imageOutput: 30,
    basis: 'OpenAI reference rates; Foundry invoice may differ',
    source: 'https://developers.openai.com/api/docs/models/gpt-image-2.5-flare',
  });
});
