export type TokenUsage = {
  readonly input: number;
  readonly output: number;
  readonly imageInput: number;
  readonly imageOutput: number;
  readonly cachedInput: number;
};
export type TokenPrices = {
  readonly input: number;
  readonly output: number;
  readonly imageInput: number;
  readonly imageOutput: number;
  readonly cachedInput: number;
};
const million = 1_000_000;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

export const bedrockTokens = (raw: unknown): TokenUsage | null => {
  const usage = object(raw);
  const input = count(usage.inputTokens);
  const output = count(usage.outputTokens);
  const cachedInput = count(usage.cacheReadInputTokens) ?? 0;
  // Converse output already includes thinking; cache reads are separate input.
  // We do not request cache writes, whose price depends on cache duration.
  if (
    input === undefined ||
    output === undefined ||
    (count(usage.cacheWriteInputTokens) ?? 0) > 0
  ) {
    return null;
  }
  return { input, output, cachedInput, imageInput: 0, imageOutput: 0 };
};
export const foundryTokens = (raw: unknown): TokenUsage | null => {
  const usage = object(raw);
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  const inputs = object(usage.input_tokens_details);
  const imageInput = count(inputs.image_tokens);
  const textInput = count(inputs.text_tokens);
  // Image edits bill output images separately from their text/image input.
  if (
    input === undefined ||
    output === undefined ||
    imageInput === undefined ||
    textInput === undefined ||
    imageInput + textInput !== input
  ) {
    return null;
  }
  if ((count(inputs.cached_tokens) ?? 0) > 0) {
    return null;
  }
  return {
    input: textInput,
    output: 0,
    imageInput,
    imageOutput: output,
    cachedInput: 0,
  };
};
export const estimateUsd = (usage: TokenUsage, prices: TokenPrices): number =>
  (usage.input * prices.input +
    usage.output * prices.output +
    usage.imageInput * prices.imageInput +
    usage.imageOutput * prices.imageOutput +
    usage.cachedInput * prices.cachedInput) /
  million;
