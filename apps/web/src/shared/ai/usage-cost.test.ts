import { expect, it } from 'bun:test';
import { estimateUsd, foundryTokens, vertexTokens } from './usage-cost.ts';

const expectedVertexCost = 0.002_82;
const expectedImageCost = 0.0079;
it('counts thinking and cached input without double billing them', () => {
  const tokens = vertexTokens({
    promptTokenCount: 1000,
    cachedContentTokenCount: 200,
    candidatesTokenCount: 100,
    thoughtsTokenCount: 300,
  });
  expect(tokens).toEqual({
    input: 800,
    output: 400,
    imageInput: 0,
    imageOutput: 0,
    cachedInput: 200,
  });
  expect(
    estimateUsd(
      tokens ?? {
        input: 0,
        output: 0,
        imageInput: 0,
        imageOutput: 0,
        cachedInput: 0,
      },
      {
        input: 1,
        output: 5,
        imageInput: 0,
        imageOutput: 0,
        cachedInput: 0.1,
      },
    ),
  ).toBeCloseTo(expectedVertexCost);
});
it('prices image edits by their separate text and image token rates', () => {
  const tokens = foundryTokens(
    JSON.parse(
      '{"input_tokens":1000,"input_tokens_details":{"text_tokens":100,"image_tokens":900},"output_tokens":500}',
    ),
  );
  expect(tokens).toEqual({
    input: 100,
    output: 0,
    imageInput: 900,
    imageOutput: 500,
    cachedInput: 0,
  });
  expect(
    estimateUsd(
      tokens ?? {
        input: 0,
        output: 0,
        imageInput: 0,
        imageOutput: 0,
        cachedInput: 0,
      },
      {
        input: 2,
        output: 0,
        imageInput: 3,
        imageOutput: 10,
        cachedInput: 0,
      },
    ),
  ).toBeCloseTo(expectedImageCost);
});
it('leaves incomplete or unsupported billing metadata unknown', () => {
  for (const raw of [
    null,
    {},
    { promptTokenCount: -1, candidatesTokenCount: 1 },
    {
      promptTokenCount: 1,
      candidatesTokenCount: 1,
      cachedContentTokenCount: 2,
    },
  ]) {
    expect(vertexTokens(raw)).toBeNull();
  }
  expect(
    foundryTokens(JSON.parse('{"input_tokens":100,"output_tokens":500}')),
  ).toBeNull();
});
