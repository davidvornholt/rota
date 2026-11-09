import { Effect, Schema } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { pool } from '#/shared/db/database.ts';
import { apiPrice } from './api-prices.ts';
import {
  attemptsUsd,
  claudeAttempts,
  estimateUsd,
  foundryTokens,
  type TokenUsage,
  totalTokens,
} from './usage-cost.ts';

class UsageError extends Schema.TaggedError<UsageError>()('UsageError', {
  message: Schema.String,
}) {}
type Provider = 'anthropic' | 'foundry';

const tokenAmounts = (tokens: TokenUsage, cost: number | null) => [
  tokens.input + tokens.imageInput + tokens.cachedInput + tokens.cacheWrite,
  tokens.output + tokens.imageOutput,
  cost,
];
const usageAmounts = (
  provider: Provider,
  model: string,
  usage: unknown,
  price: ReturnType<typeof apiPrice>,
) => {
  if (provider === 'foundry') {
    const tokens = foundryTokens(usage);
    return tokens
      ? tokenAmounts(tokens, price ? estimateUsd(tokens, price) : null)
      : [null, null, null];
  }
  const attempts = claudeAttempts(usage);
  return attempts
    ? tokenAmounts(
        totalTokens(attempts),
        attemptsUsd(attempts, (served) =>
          apiPrice({ provider, model: served ?? model }),
        ),
      )
    : [null, null, null];
};
export const makeUsageLedger = Effect.gen(function* () {
  const owner = yield* WardrobeOwner;
  const measure = async <A>(
    {
      provider,
      model,
      operation,
    }: {
      readonly provider: Provider;
      readonly model: string;
      readonly operation: string;
    },
    call: () => Promise<A>,
    extract: (answer: A) => {
      readonly usage: unknown;
      readonly success: boolean;
    },
  ): Promise<A> => {
    const enabled = await pool.query(
      'select 1 from member where id = $1 and enabled',
      [owner.id],
    );
    if (!enabled.rowCount) {
      throw new UsageError({ message: 'This account no longer has access.' });
    }
    const price = apiPrice({
      provider,
      model,
    });
    const id = crypto.randomUUID();
    await pool.query(
      `insert into api_usage (id, owner_id, provider, model, operation, price_snapshot)
      values ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        owner.id,
        provider,
        model,
        operation,
        price ? JSON.stringify(price) : null,
      ],
    );
    let result: A;
    try {
      result = await call();
    } catch (error) {
      await pool.query("update api_usage set status = 'failed' where id = $1", [
        id,
      ]);
      throw error;
    }
    const { usage, success } = extract(result);
    await pool.query(
      `update api_usage set status = $6, usage = $2, input_tokens = $3,
      output_tokens = $4, estimated_usd = $5 where id = $1`,
      [
        id,
        JSON.stringify(usage),
        ...usageAmounts(provider, model, usage, price),
        success ? 'success' : 'failed',
      ],
    );
    return result;
  };
  return { measure };
});
