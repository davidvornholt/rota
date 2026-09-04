/**
 * Production server: serves the static client assets from dist/client and
 * hands everything else to the TanStack Start SSR handler. The server entry
 * produced by `vite build` (dist/server/server.js) only exports a fetch
 * handler and does not serve static files itself.
 */

import { realpath } from 'node:fs/promises';
import process from 'node:process';

import { parsePort } from './server-config.ts';

type FetchHandler = (request: Request) => Promise<Response> | Response;

type StartServerEntry = {
  readonly default: {
    readonly fetch: FetchHandler;
  };
};

const immutableCache = 'public, max-age=31536000, immutable';
const okStatus = 200;
const healthPath = '/api/healthz';
const pagePath = '/login';
const selfCheckTimeout = 10_000;
const tickPath = '/api/internal/tick';
const tickTokenHeader = 'x-rota-tick-token';
const tickInterval = 60_000;

const openClientFile = (pathname: string, clientDirUrl: URL) => {
  try {
    // Decode first so encoded separators and dot segments are resolved by the
    // URL parser instead of reaching Bun.file, which rejects them with a
    // TypeError that would otherwise surface as a 500.
    return Bun.file(new URL(`.${decodeURIComponent(pathname)}`, clientDirUrl));
  } catch {
    // Invalid percent escapes never name a built asset.
    return null;
  }
};

const resolveRealPath = async (path: string): Promise<string | null> => {
  try {
    return await realpath(path);
  } catch {
    // Missing files, broken links, and symlink loops are all "not ours to
    // serve"; the request falls through to SSR.
    return null;
  }
};

export const createFetchHandler = async (
  clientDir: string,
  ssrFetch: FetchHandler,
): Promise<FetchHandler> => {
  const clientDirUrl = Bun.pathToFileURL(
    clientDir.endsWith('/') ? clientDir : `${clientDir}/`,
  );
  // Resolved once at startup so a deployment that reaches dist/client through
  // a symlinked release directory still compares like for like below.
  const clientRoot = `${await realpath(Bun.fileURLToPath(clientDirUrl))}/`;

  const serveStatic = async (pathname: string): Promise<Response | null> => {
    const candidate = openClientFile(pathname, clientDirUrl)?.name;
    const resolved =
      candidate === undefined ? null : await resolveRealPath(candidate);
    // Containment: both a decoded path and a symlink stored inside the client
    // directory can point above it, and only what really resolves inside it is
    // ours to serve.
    if (resolved?.startsWith(clientRoot) !== true) {
      return null;
    }
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
      return null;
    }
    const headers = pathname.startsWith('/assets/')
      ? { 'cache-control': immutableCache }
      : undefined;
    return new Response(file, { headers });
  };

  return async (request) => {
    const { pathname } = new URL(request.url);
    return (await serveStatic(pathname)) ?? ssrFetch(request);
  };
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const abortBoot = async (reason: string): Promise<never> => {
  await Bun.write(Bun.stderr, `Rota cannot start: ${reason}\n`);
  return process.exit(1);
};

const parseBootPort = async (value: string | undefined): Promise<number> => {
  try {
    return parsePort(value);
  } catch (error) {
    return await abortBoot(describeError(error));
  }
};

const loadSsrFetch = async (entryUrl: URL): Promise<FetchHandler> => {
  try {
    const { default: startServer } = (await import(
      entryUrl.href
    )) as StartServerEntry;
    return (request) => startServer.fetch(request);
  } catch (error) {
    return abortBoot(
      `loading the SSR bundle ${entryUrl.pathname} failed: ${describeError(error)}. Either it has not been built (\`bun run build\`) or an environment value it validates as it loads is missing or malformed (see apps/web/README.md).`,
    );
  }
};

const timedOut = Symbol('boot self-check timeout');

/**
 * One in-process request through the composed handler, before the port is
 * bound. A handler that never settles loses the race with the timeout, so a
 * stuck boot reports itself instead of hanging in a state no supervisor can
 * tell apart from slow startup.
 */
const requestFailure = async (
  handler: FetchHandler,
  port: number,
  path: string,
  timeoutMs: number,
): Promise<string | null> => {
  try {
    const answer = await Promise.race([
      handler(new Request(`http://127.0.0.1:${port}${path}`)),
      // Annotated: a unique symbol widens out of a callback, losing the check.
      Bun.sleep(timeoutMs).then((): typeof timedOut => timedOut),
    ]);
    if (answer === timedOut) {
      return `${path} timed out after ${timeoutMs}ms`;
    }
    return answer.status === okStatus
      ? null
      : `${path} answered ${answer.status} instead of ${okStatus}`;
  } catch (error) {
    return `${path} threw: ${describeError(error)}`;
  }
};

/**
 * What the process proves before it listens: the liveness route answers, and a
 * real page renders. Liveness runs first as the cheaper check; it touches
 * neither database nor OAuth. The sign-in page then covers what it never
 * reaches — router, React render, document shell — and needs no database
 * either: its session lookup fails closed and renders signed out. Anything
 * else means the process cannot serve requests, and one that stays up in that
 * state answers health checks with a lie.
 */
export const bootSelfCheckFailure = async (
  handler: FetchHandler,
  port: number,
  timeoutMs: number,
): Promise<string | null> =>
  (await requestFailure(handler, port, healthPath, timeoutMs)) ??
  (await requestFailure(handler, port, pagePath, timeoutMs));

/**
 * The scheduler: once a minute the process asks itself, in-process and without
 * touching the network, whether the day needs a proposal. The token is minted
 * here and handed to the bundle through the environment before it loads, so
 * only this process can open that route.
 */
export const startScheduler = (
  handler: FetchHandler,
  port: number,
  token: string,
  intervalMs: number,
): ReturnType<typeof setInterval> =>
  setInterval(() => {
    Promise.resolve(
      handler(
        new Request(`http://127.0.0.1:${port}${tickPath}`, {
          method: 'POST',
          headers: { [tickTokenHeader]: token },
        }),
      ),
    )
      .then(async (response) => {
        if (!response.ok) {
          await Bun.write(
            Bun.stderr,
            `The scheduled tick answered ${response.status}.\n`,
          );
        }
      })
      .catch(async (error: unknown) => {
        await Bun.write(
          Bun.stderr,
          `The scheduled tick failed: ${describeError(error)}\n`,
        );
      });
  }, intervalMs);

// Only the script entry point boots a server; tests import the exports above.
if (import.meta.main) {
  // Cheapest precondition first: an unusable PORT must not cost an SSR bundle
  // load before it is reported.
  const port = await parseBootPort(Bun.env.PORT);
  const tickToken = crypto.randomUUID();
  process.env.ROTA_TICK_TOKEN = tickToken;
  const clientDir = Bun.fileURLToPath(
    new URL('../dist/client/', import.meta.url),
  );
  const ssrFetch = await loadSsrFetch(
    new URL('../dist/server/server.js', import.meta.url),
  );
  const handler = await createFetchHandler(clientDir, ssrFetch).catch(
    (error: unknown) =>
      abortBoot(
        `the client asset directory ${clientDir} is unreadable. Run \`bun run build\` first. ${describeError(error)}`,
      ),
  );

  const failure = await bootSelfCheckFailure(handler, port, selfCheckTimeout);
  if (failure !== null) {
    await abortBoot(
      `the boot self-check request to ${failure}. Check the environment values documented in apps/web/README.md.`,
    );
  }

  const server = Bun.serve({
    port,
    hostname: '0.0.0.0',
    // Bun's development mode answers an unhandled error with a debug page
    // carrying this script's source and absolute paths.
    development: false,
    fetch: handler,
  });

  startScheduler(handler, port, tickToken, tickInterval);

  await Bun.write(Bun.stdout, `Rota is running at ${server.url}\n`);
}
