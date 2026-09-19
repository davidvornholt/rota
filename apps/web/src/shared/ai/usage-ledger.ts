import { Data, Effect } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { pool } from '#/shared/db/pool.ts';
import { env } from '#/shared/env.ts';
import { apiPrice } from './api-prices.ts';
import {
  estimateUsd,
  foundryTokens,
  type TokenPrices,
  type TokenUsage,
  vertexTokens,
} from './usage-cost.ts';

class UsageError extends Data.TaggedError('UsageError')<{
  readonly message: string;
}> {}
const usageAmounts = (
  tokens: TokenUsage | null,
  price: TokenPrices | undefined,
) => {
  if (!tokens) {
    return [null, null, null];
  }
  return [
    tokens.input + tokens.imageInput + tokens.cachedInput,
    tokens.output + tokens.imageOutput,
    price ? estimateUsd(tokens, price) : null,
  ];
};
export const makeUsageLedger = Effect.gen(function* () {
  const owner = yield* WardrobeOwner;
  const measure = async <A>(
    {
      provider,
      model,
      operation,
    }: {
      readonly provider: 'vertex' | 'foundry';
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
      location: env.GOOGLE_VERTEX_LOCATION,
      at: new Date(),
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
    const tokens =
      provider === 'vertex' ? vertexTokens(usage) : foundryTokens(usage);
    await pool.query(
      `update api_usage set status = $6, usage = $2, input_tokens = $3,
      output_tokens = $4, estimated_usd = $5 where id = $1`,
      [
        id,
        JSON.stringify(usage),
        ...usageAmounts(tokens, price),
        success ? 'success' : 'failed',
      ],
    );
    return result;
  };
  return { measure };
});
