import { expect, it } from 'bun:test';
import { apiPrice } from './api-prices.ts';

const vertex = {
  provider: 'vertex',
  model: 'gemini-3.8-flash',
  location: 'global',
  at: new Date('2026-12-31T23:59:59Z'),
} as const;

it('uses published global introductory rates until their expiry', () => {
  expect(apiPrice(vertex)).toMatchObject({
    input: 0.75,
    output: 3.75,
    imageInput: 0.75,
    cachedInput: 0.075,
  });
  expect(
    apiPrice({ ...vertex, at: new Date('2027-01-01T00:00:00Z') }),
  ).toMatchObject({ input: 1.5, output: 7.5, cachedInput: 0.15 });
});

it('uses regional rates for non-global Vertex requests', () => {
  expect(apiPrice({ ...vertex, location: 'europe-west1' })).toMatchObject({
    input: 0.825,
    output: 4.125,
    cachedInput: 0.0825,
  });
  expect(
    apiPrice({
      ...vertex,
      location: 'europe-west1',
      at: new Date('2027-01-01T00:00:00Z'),
    }),
  ).toMatchObject({ input: 1.65, output: 8.25, cachedInput: 0.165 });
});

it('does not assume rates for unknown model or deployment names', () => {
  expect(apiPrice({ ...vertex, model: 'unknown' })).toBeUndefined();
  expect(apiPrice({ ...vertex, provider: 'foundry' })).toBeUndefined();
});

it('labels Foundry image estimates with their actual OpenAI reference source', () => {
  expect(
    apiPrice({ ...vertex, provider: 'foundry', model: 'gpt-image-2.5-flare' }),
  ).toMatchObject({
    input: 5,
    imageInput: 8,
    imageOutput: 30,
    basis: 'OpenAI reference rates; Foundry invoice may differ',
    source: 'https://developers.openai.com/api/docs/models/gpt-image-2.5-flare',
  });
});
