import { expect, it } from 'bun:test';
import { Deferred, Effect, Fiber, TestClock, TestContext } from 'effect';
import { runServerFunction } from './server-request.ts';

it("keeps a long RPC alive beyond Bun's idle limit but aborts a stuck handler at its finite deadline", async () => {
  let aborted = false;
  const result = Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    const fiber = yield* Effect.fork(
      runServerFunction((request) => {
        request.signal.addEventListener('abort', () => {
          aborted = true;
        });
        Effect.runSync(Deferred.succeed(started, undefined));
        return new Promise(() => undefined);
      }, new Request('http://rota.test/_serverFn/slow')),
    );
    yield* Deferred.await(started);
    yield* TestClock.adjust('360 seconds');
    expect((yield* Fiber.poll(fiber))._tag).toBe('None');
    yield* TestClock.adjust('61 seconds');
    return yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestContext.TestContext));
  const response = await Effect.runPromise(result);
  expect(aborted).toBeTrue();
  const gatewayTimeout = 504;
  expect(response.status).toBe(gatewayTimeout);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.text()).toContain('Refresh to check');
});
