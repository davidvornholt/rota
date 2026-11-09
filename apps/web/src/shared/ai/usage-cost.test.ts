import { expect, it } from 'bun:test';
import {
  attemptsUsd,
  claudeAttempts,
  estimateUsd,
  foundryTokens,
  type TokenPrices,
  totalTokens,
} from './usage-cost.ts';

const noTokens = {
  input: 0,
  output: 0,
  imageInput: 0,
  imageOutput: 0,
  cachedInput: 0,
  cacheWrite: 0,
};
const claudeRates: TokenPrices = {
  input: 2,
  output: 10,
  imageInput: 0,
  imageOutput: 0,
  cachedInput: 0.2,
  cacheWrite: 2.5,
};
const expectedClaudeCost = 0.009_64;
const expectedFallbackCost = 0.0052;
const expectedImageCost = 0.0079;

it('counts thinking, cache reads and cache writes without double billing them', () => {
  const attempts = claudeAttempts({
    input_tokens: 800,
    cache_read_input_tokens: 200,
    cache_creation_input_tokens: 2000,
    cache_creation: {
      ephemeral_5m_input_tokens: 2000,
      ephemeral_1h_input_tokens: 0,
    },
    output_tokens: 300,
    iterations: null,
  });
  expect(attempts).toEqual([
    {
      model: null,
      tokens: {
        ...noTokens,
        input: 800,
        output: 300,
        cachedInput: 200,
        cacheWrite: 2000,
      },
    },
  ]);
  expect(attemptsUsd(attempts ?? [], () => claudeRates)).toBeCloseTo(
    expectedClaudeCost,
  );
});

it('counts the declined attempt and the fallback model that answered', () => {
  const attempts = claudeAttempts({
    // The top level covers only the attempt that answered.
    input_tokens: 1000,
    output_tokens: 100,
    iterations: [
      {
        type: 'message',
        model: null,
        input_tokens: 1000,
        output_tokens: 20,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_creation: null,
      },
      {
        type: 'fallback_message',
        model: 'claude-sonnet-5',
        input_tokens: 1000,
        output_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_creation: null,
      },
    ],
  });
  expect(attempts?.map(({ model }) => model)).toEqual([
    null,
    'claude-sonnet-5',
  ]);
  expect(totalTokens(attempts ?? [])).toEqual({
    ...noTokens,
    input: 2000,
    output: 120,
  });
  const priced: Array<string | null> = [];
  expect(
    attemptsUsd(attempts ?? [], (model) => {
      priced.push(model);
      return claudeRates;
    }),
  ).toBeCloseTo(expectedFallbackCost);
  expect(priced).toEqual([null, 'claude-sonnet-5']);
  expect(
    attemptsUsd(attempts ?? [], (model) =>
      model === null ? claudeRates : undefined,
    ),
  ).toBeNull();
});

it('prices image edits by their separate text and image token rates', () => {
  const tokens = foundryTokens(
    JSON.parse(
      '{"input_tokens":1000,"input_tokens_details":{"text_tokens":100,"image_tokens":900},"output_tokens":500}',
    ),
  );
  expect(tokens).toEqual({
    ...noTokens,
    input: 100,
    imageInput: 900,
    imageOutput: 500,
  });
  expect(
    estimateUsd(tokens ?? noTokens, {
      input: 2,
      output: 0,
      imageInput: 3,
      imageOutput: 10,
      cachedInput: 0,
      cacheWrite: 0,
    }),
  ).toBeCloseTo(expectedImageCost);
});

it('leaves incomplete or unsupported billing metadata unknown', () => {
  for (const raw of [
    null,
    {},
    { input_tokens: -1, output_tokens: 1 },
    {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation: {
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 2,
      },
    },
    {
      input_tokens: 1,
      output_tokens: 1,
      iterations: [{ type: 'compaction', input_tokens: 1, output_tokens: 1 }],
    },
    {
      input_tokens: 1,
      output_tokens: 1,
      iterations: [{ type: 'message', input_tokens: 1 }],
    },
  ]) {
    expect(claudeAttempts(raw)).toBeNull();
  }
  expect(
    foundryTokens(JSON.parse('{"input_tokens":100,"output_tokens":500}')),
  ).toBeNull();
});
