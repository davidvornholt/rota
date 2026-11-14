import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Effect, Layer, type Schema } from 'effect';
import type { Identity } from '#/shared/auth/identity.ts';
import { answer, input, message } from './claude-request-test-support.ts';

type Query = { readonly sql: string; readonly values: ReadonlyArray<unknown> };
const queries: Array<Query> = [];

// The usage ledger writes to Postgres and the service reads the API key from
// the environment. Both are replaced, so no test touches a database or a key.
mock.module('#/shared/db/database.ts', () => ({
  pool: {
    query: (sql: string, values: ReadonlyArray<unknown> = []) => {
      queries.push({ sql, values });
      return Promise.resolve({ rowCount: 1, rows: [] });
    },
  },
}));
mock.module('#/shared/env.ts', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key' },
}));

const { Claude } = await import('./claude.ts');
const { WardrobeOwner } = await import('#/shared/auth/identity.ts');

const owner: Identity = {
  id: 'owner-1',
  userId: 'user-1',
  name: 'Test owner',
  admin: false,
};
const realFetch = globalThis.fetch;

/** Makes the real SDK client receive `reply` from a fake network, never the Claude API. */
const replyWith = (reply: ReturnType<typeof message>) => {
  globalThis.fetch = Object.assign(
    () => Promise.resolve(Response.json(reply)),
    { preconnect: realFetch.preconnect },
  );
};

const generate = <A, I>(
  request: typeof input & { schema: Schema.Codec<A, I> },
) =>
  Effect.runPromise(
    Effect.result(
      Effect.gen(function* () {
        const claude = yield* Claude;
        return yield* claude.generateJson(request);
      }).pipe(
        Effect.provide(
          Claude.layer.pipe(Layer.provide(Layer.succeed(WardrobeOwner, owner))),
        ),
      ),
    ),
  );

/** The status and the cost the ledger finally stored for the one request. */
const finalRow = () => {
  const update = queries.find(({ sql }) => sql.startsWith('update api_usage'));
  return { status: update?.values.at(-1), cost: update?.values.at(-2) };
};

beforeEach(() => {
  queries.length = 0;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Claude usage ledger', () => {
  it('records a request whose answer matches the schema as a success', async () => {
    replyWith(answer('{"choice":"rain jacket"}'));
    expect(await generate(input)).toMatchObject({ _tag: 'Success' });
    expect(finalRow().status).toBe('success');
  });

  it('records an answer outside the schema as failed, at the cost it still incurred', async () => {
    replyWith(answer('{"wrong":true}'));
    expect(await generate(input)).toMatchObject({ _tag: 'Failure' });
    const failed = finalRow();

    queries.length = 0;
    replyWith(answer('{"choice":"rain jacket"}'));
    await generate(input);
    expect(failed.status).toBe('failed');
    expect(failed.cost).not.toBeNull();
    expect(failed.cost).toBe(finalRow().cost);
  });

  it('records an answer that did not finish as failed', async () => {
    replyWith(message([], { stop_reason: 'max_tokens', stop_details: null }));
    expect(await generate(input)).toMatchObject({ _tag: 'Failure' });
    expect(finalRow().status).toBe('failed');
  });
});
