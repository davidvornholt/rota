import { afterEach, describe, expect, it } from 'bun:test';
import { listen, sleep, type TCPSocketListener } from 'bun';

import {
  databaseHealthDeadlineMs,
  makeDatabaseCheck,
} from './database-health.ts';

const listeners = new Set<TCPSocketListener>();

// A server that accepts every connection and never answers.
const listenSilently = (onConnect: () => void): number => {
  const listener = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { open: onConnect, data: () => undefined },
  });
  listeners.add(listener);
  return listener.port;
};

afterEach(() => {
  for (const listener of listeners) {
    listener.stop(true);
  }
  listeners.clear();
});

const be32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

const message = (type: string, ...body: ReadonlyArray<Uint8Array>) => {
  const length = 4 + body.reduce((sum, part) => sum + part.length, 0);
  return Uint8Array.from([
    type.charCodeAt(0),
    ...be32(length),
    ...body.flatMap((part) => [...part]),
  ]);
};

// Polls until the condition holds or the time is up.
const waitUntil = async (
  condition: () => boolean,
  untilMs: number,
): Promise<void> => {
  if (condition() || performance.now() >= untilMs) {
    return;
  }
  await sleep(100);
  await waitUntil(condition, untilMs);
};

const cancelRequestCode = 80_877_102;

type HangingServer = {
  readonly open: () => number;
  readonly port: number;
  readonly queries: () => number;
  readonly startups: () => number;
};

// A server that completes the PostgreSQL handshake, never answers a query and
// ignores cancel requests, like a database whose process is stuck.
const listenHandshakeOnly = (): HangingServer => {
  let open = 0;
  let queries = 0;
  let startups = 0;
  const started = new WeakSet<object>();
  const listener = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open: () => {
        open += 1;
      },
      close: () => {
        open -= 1;
      },
      data: (socket, data) => {
        if (!started.has(socket)) {
          started.add(socket);
          const code = new DataView(
            data.buffer,
            data.byteOffset,
            data.byteLength,
          ).getUint32(4);
          if (code === cancelRequestCode) {
            return;
          }
          startups += 1;
          socket.write(message('R', be32(0)));
          socket.write(message('K', be32(1), be32(2)));
          socket.write(message('Z', new Uint8Array([73])));
          return;
        }
        if (data[0] === 81 || data[0] === 80) {
          queries += 1;
        }
      },
    },
  });
  listeners.add(listener);
  return {
    open: () => open,
    port: listener.port,
    queries: () => queries,
    startups: () => startups,
  };
};

const urlFor = (port: number) =>
  `postgresql://app:app@127.0.0.1:${port}/app?sslmode=disable`;

describe('database health check', () => {
  it('reports unavailable at the deadline when the database accepts a connection and never answers', async () => {
    let connections = 0;
    const port = listenSilently(() => {
      connections += 1;
    });
    const check = makeDatabaseCheck(urlFor(port));
    const startedAt = performance.now();

    const answers = await Promise.all([check(), check(), check()]);
    const elapsed = performance.now() - startedAt;

    expect(answers).toEqual([false, false, false]);
    expect(elapsed).toBeGreaterThanOrEqual(databaseHealthDeadlineMs - 100);
    expect(elapsed).toBeLessThan(databaseHealthDeadlineMs + 500);
    expect(connections).toBe(1);
  });

  it('reports unavailable at the deadline when the database accepts the login and never answers the query', async () => {
    const server = listenHandshakeOnly();
    const check = makeDatabaseCheck(urlFor(server.port));
    const startedAt = performance.now();

    const answers = await Promise.all([check(), check(), check()]);
    const elapsed = performance.now() - startedAt;

    expect(answers).toEqual([false, false, false]);
    expect(elapsed).toBeGreaterThanOrEqual(databaseHealthDeadlineMs - 100);
    expect(elapsed).toBeLessThan(databaseHealthDeadlineMs + 500);
    expect(server.startups()).toBe(1);
    expect(server.queries()).toBe(1);
  });

  it('closes its connection after a hung database stops waiting and checks again afterwards', async () => {
    const server = listenHandshakeOnly();
    const check = makeDatabaseCheck(urlFor(server.port));

    await check();
    await waitUntil(() => server.open() === 0, performance.now() + 15_000);
    expect(server.open()).toBe(0);

    const startupsBefore = server.startups();
    await check();
    expect(server.startups()).toBeGreaterThan(startupsBefore);
  }, 30_000);

  it('reports unavailable at once when nothing listens', async () => {
    const listener = listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data: () => undefined },
    });
    const { port } = listener;
    listener.stop(true);

    expect(await makeDatabaseCheck(urlFor(port))()).toBe(false);
  });

  it('checks again after a failed check instead of remembering the failure', async () => {
    let connections = 0;
    const port = listenSilently(() => {
      connections += 1;
    });
    const check = makeDatabaseCheck(urlFor(port));

    await check();
    await check();

    expect(connections).toBe(2);
  });
});
