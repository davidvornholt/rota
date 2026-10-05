import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import { privateResponseHeaders } from '../src/shared/auth/private-response.ts';
import { createFetchHandler, serveRequest, shutdown } from './serve.ts';

const serverFunctionPath = '/_serverFn/test';
const unauthorized = 401;
const conflict = 409;
const frameworkHeader = 'x-framework-header';

const frameworkFailure = (status: number): Response =>
  new Response('serialized failure', {
    status,
    headers: {
      'content-type': 'application/json',
      'x-tss-serialized': 'true',
      [frameworkHeader]: 'preserved',
    },
  });

describe('createFetchHandler', () => {
  it('lets server functions finish after the ordinary socket idle timeout', async () => {
    const ordinaryIdleSeconds = 1;
    const modelDelay = '1500 millis';
    const result = Effect.acquireUseRelease(
      Effect.sync(() =>
        Bun.serve({
          hostname: '127.0.0.1',
          port: 0,
          idleTimeout: ordinaryIdleSeconds,
          fetch: (request, instance) =>
            serveRequest(
              () =>
                Effect.runPromise(
                  Effect.sleep(modelDelay).pipe(
                    Effect.as(new Response('outfit ready')),
                  ),
                ),
              request,
              instance,
            ),
        }),
      ),
      (server) =>
        Effect.tryPromise(() =>
          fetch(new URL(serverFunctionPath, server.url)),
        ).pipe(
          Effect.flatMap((response) => Effect.promise(() => response.text())),
        ),
      (server) => Effect.sync(() => server.stop(true)),
    );
    expect(await Effect.runPromise(result)).toBe('outfit ready');
  });

  it.each([
    ['unauthorized', unauthorized],
    ['safe conflict', conflict],
  ])(
    'preserves the private policy on a %s server-function failure',
    async (_name, status) => {
      const handler = await createFetchHandler(
        new URL('.', import.meta.url).pathname,
        () => frameworkFailure(status),
      );

      const response = await handler(
        new Request(`https://rota.test${serverFunctionPath}`, {
          headers: {
            accept:
              'text/x-component-stream, application/x-ndjson, application/json',
            'sec-fetch-site': 'same-origin',
            'x-tsr-serverFn': 'true',
          },
        }),
      );

      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('x-tss-serialized')).toBe('true');
      expect(response.headers.get(frameworkHeader)).toBe('preserved');
      expect(await response.text()).toBe('serialized failure');
      for (const [name, value] of Object.entries(privateResponseHeaders)) {
        expect(response.headers.get(name)).toBe(value);
      }
    },
  );
});

describe('shutdown', () => {
  const serveUntil = (answer: Promise<void>) =>
    Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: async () => {
        await answer;
        return new Response('answered');
      },
    });

  it('closes the database only after the request in flight has answered', async () => {
    const events: Array<string> = [];
    const { promise: answer, resolve } = Promise.withResolvers<void>();
    const server = serveUntil(answer);
    const inFlight = fetch(server.url).then((response) => response.text());
    await Bun.sleep(50);

    const stopped = shutdown(
      server,
      () => {
        events.push('database closed');
        return Promise.resolve();
      },
      5000,
    );
    await Bun.sleep(50);
    events.push('answered');
    resolve();

    expect(await inFlight).toBe('answered');
    await stopped;
    expect(events).toEqual(['answered', 'database closed']);
  });

  it('cuts off a request that outlasts the drain and still closes the database', async () => {
    let closed = false;
    const server = serveUntil(new Promise<void>(() => undefined));
    const inFlight = fetch(server.url).then(
      () => 'answered',
      () => 'cut off',
    );
    await Bun.sleep(50);

    await shutdown(
      server,
      () => {
        closed = true;
        return Promise.resolve();
      },
      100,
    );

    expect(await inFlight).toBe('cut off');
    expect(closed).toBe(true);
  });
});
