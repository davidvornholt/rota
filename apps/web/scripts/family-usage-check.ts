import { expect } from '@playwright/test';
import { Effect } from 'effect';
import { apiPrice } from '../src/shared/ai/api-prices.ts';
import { estimateUsd } from '../src/shared/ai/usage-cost.ts';
import { makeUsageLedger } from '../src/shared/ai/usage-ledger.ts';
import { WardrobeOwner } from '../src/shared/auth/identity.ts';
import { pool } from '../src/shared/db/pool.ts';

const databaseCostDecimals = 8;
export const checkUsage = async (member: { id: string; userId: string }) => {
  const ledger = await Effect.runPromise(
    makeUsageLedger.pipe(
      Effect.provideService(WardrobeOwner, {
        ...member,
        name: 'Alex (demo)',
        admin: false,
      }),
    ),
  );
  const operation = {
    provider: 'bedrock' as const,
    model: 'global.anthropic.claude-sonnet-5-5',
    operation: 'Outfit suggestion',
  };
  const usage = { inputTokens: 1000, outputTokens: 100 };
  await ledger.measure(
    operation,
    () => Promise.resolve(usage),
    (tokens) => ({
      usage: tokens,
      success: true,
    }),
  );
  await expect(
    ledger.measure(
      operation,
      () => Promise.reject(new Error('Simulated provider timeout')),
      () => ({ usage: null, success: false }),
    ),
  ).rejects.toThrow();
  await ledger.measure(
    { ...operation, model: 'unknown-test-model' },
    () => Promise.resolve(usage),
    (tokens) => ({ usage: tokens, success: true }),
  );
  const spending = await pool.query<{
    status: string;
    cost: string | null;
    createdAt: Date;
    price: unknown;
  }>(
    `select status, estimated_usd as cost, created_at as "createdAt", price_snapshot as price
    from api_usage where owner_id = $1 order by created_at`,
    [member.id],
  );
  const price = apiPrice(operation);
  if (!price) {
    throw new Error(
      'The family billing fixture requires a supported code-owned model.',
    );
  }
  const expected = estimateUsd(
    { input: 1000, output: 100, imageInput: 0, imageOutput: 0, cachedInput: 0 },
    price,
  );
  expect(
    spending.rows.map(({ status, cost, price: snapshot }) => ({
      status,
      cost,
      price: snapshot,
    })),
  ).toEqual([
    { status: 'success', cost: expected.toFixed(databaseCostDecimals), price },
    {
      status: 'failed',
      cost: null,
      price,
    },
    { status: 'success', cost: null, price: null },
  ]);
};
