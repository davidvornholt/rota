import { expect, it } from 'bun:test';
import { apiPrice } from './api-prices.ts';

const claude = { provider: 'anthropic', model: 'claude-sonnet-5-5' } as const;
it('prices Claude Sonnet 5.5 and its fallback model at the same rates', () => {
  expect(apiPrice(claude)).toMatchObject({
    input: 2,
    output: 10,
    cachedInput: 0.2,
    cacheWrite: 2.5,
  });
  expect(apiPrice({ ...claude, model: 'claude-sonnet-5' })).toEqual(
    apiPrice(claude),
  );
});
it('keeps unknown models and other providers unpriced', () => {
  expect(apiPrice({ ...claude, model: 'unknown' })).toBeUndefined();
  expect(apiPrice({ ...claude, model: 'claude-opus-5-5' })).toBeUndefined();
  expect(apiPrice({ ...claude, provider: 'foundry' })).toBeUndefined();
});
it('labels Foundry image estimates as OpenAI reference rates', () => {
  for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
    const price = apiPrice({ provider: 'foundry', model });
    expect(price?.basis).toBe(
      'OpenAI reference rates; Foundry invoice may differ',
    );
    expect(price?.source).toBe(
      `https://developers.openai.com/api/docs/models/${model}`,
    );
  }
  expect(
    apiPrice({ provider: 'anthropic', model: 'gpt-image-2.5-sunburst' }),
  ).toBeUndefined();
});
