export type TokenUsage = {
  readonly input: number;
  readonly output: number;
  readonly imageInput: number;
  readonly imageOutput: number;
  readonly cachedInput: number;
  readonly cacheWrite: number;
};
export type TokenPrices = {
  readonly input: number;
  readonly output: number;
  readonly imageInput: number;
  readonly imageOutput: number;
  readonly cachedInput: number;
  /** Five-minute prompt cache writes. */
  readonly cacheWrite: number;
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

/** One billed Claude attempt; a null model is the one the request named. */
export type ClaudeAttempt = {
  readonly model: string | null;
  readonly tokens: TokenUsage;
};

const claudeAttempt = (raw: unknown): ClaudeAttempt | null => {
  const usage = object(raw);
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  // Output already includes thinking; cache reads and writes are separate input.
  // Rota never asks for one-hour cache writes, which cost more than five-minute ones.
  if (
    input === undefined ||
    output === undefined ||
    (count(object(usage.cache_creation).ephemeral_1h_input_tokens) ?? 0) > 0
  ) {
    return null;
  }
  return {
    model: typeof usage.model === 'string' ? usage.model : null,
    tokens: {
      input,
      output,
      imageInput: 0,
      imageOutput: 0,
      cachedInput: count(usage.cache_read_input_tokens) ?? 0,
      cacheWrite: count(usage.cache_creation_input_tokens) ?? 0,
    },
  };
};

/**
 * Every attempt behind a Claude answer. After a server-side fallback the
 * top-level counts cover only the attempt that answered, so the per-attempt
 * iterations are the record whenever the answer has them. They include the
 * declined attempt, which a decline before any output may leave unbilled, so
 * the estimate can err high but never misses what the fallback model used.
 */
export const claudeAttempts = (
  raw: unknown,
): ReadonlyArray<ClaudeAttempt> | null => {
  const { iterations } = object(raw);
  if (!Array.isArray(iterations) || iterations.length === 0) {
    const attempt = claudeAttempt(raw);
    return attempt ? [{ ...attempt, model: null }] : null;
  }
  const attempts = iterations.map((iteration) => {
    const { type } = object(iteration);
    return type === 'message' || type === 'fallback_message'
      ? claudeAttempt(iteration)
      : null;
  });
  return attempts.every((attempt) => attempt !== null) ? attempts : null;
};

export const totalTokens = (
  attempts: ReadonlyArray<ClaudeAttempt>,
): TokenUsage =>
  attempts.reduce<TokenUsage>(
    (total, { tokens }) => ({
      input: total.input + tokens.input,
      output: total.output + tokens.output,
      imageInput: total.imageInput + tokens.imageInput,
      imageOutput: total.imageOutput + tokens.imageOutput,
      cachedInput: total.cachedInput + tokens.cachedInput,
      cacheWrite: total.cacheWrite + tokens.cacheWrite,
    }),
    {
      input: 0,
      output: 0,
      imageInput: 0,
      imageOutput: 0,
      cachedInput: 0,
      cacheWrite: 0,
    },
  );

/** Each attempt at its own model's rates, or null when one of them has none. */
export const attemptsUsd = (
  attempts: ReadonlyArray<ClaudeAttempt>,
  priceOf: (model: string | null) => TokenPrices | undefined,
): number | null => {
  let total = 0;
  for (const { model, tokens } of attempts) {
    const price = priceOf(model);
    if (!price) {
      return null;
    }
    total += estimateUsd(tokens, price);
  }
  return total;
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
    cacheWrite: 0,
  };
};
export const estimateUsd = (usage: TokenUsage, prices: TokenPrices): number =>
  (usage.input * prices.input +
    usage.output * prices.output +
    usage.imageInput * prices.imageInput +
    usage.imageOutput * prices.imageOutput +
    usage.cachedInput * prices.cachedInput +
    usage.cacheWrite * prices.cacheWrite) /
  million;
