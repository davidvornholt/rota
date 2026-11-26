import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { BunServices } from '@effect/platform-bun';
import { ConfigProvider, Effect, FileSystem } from 'effect';
import { Command } from 'effect/cli';
import { FetchHttpClient } from 'effect/http';
import { logout, status } from './account-commands.ts';
import { dayView } from './command-fixtures.ts';
import { days } from './day-commands.ts';
import { garments } from './garment-commands.ts';
import { history } from './history-command.ts';
import { outfits } from './outfit-commands.ts';
import { root } from './root.ts';

export const origin = 'https://rota.example.com';
export const token = 'session-token';

type Sent = {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

/**
 * What a command test sets and reads: the requests the stand-in server
 * received, how it answers, the file system the CLI sees, and the temporary
 * home. `startCommandTest` resets it.
 */
export const cli = {
  sent: [] as Array<Sent>,
  answer: (_path: string): Response => Response.json({}),
  fileSystem: (real: FileSystem.FileSystem) => real,
  home: '',
};

// What the CLI wrote to stdout during the current test, one entry per write.
let written: Array<string> = [];
const realWrite = process.stdout.write.bind(process.stdout);

// Stands in for the Rota server: records each request and answers it with
// `cli.answer`, so no test reaches a real server.
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const text = await request.text();
  cli.sent.push({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    authorization: request.headers.get('authorization'),
    body: text === '' ? undefined : JSON.parse(text),
  });
  return cli.answer(`${url.pathname}${url.search}`);
}) as typeof globalThis.fetch;

const rota = root.pipe(
  Command.withSubcommands([logout, status, garments, days, outfits, history]),
);

export const printed = () => JSON.parse(written.at(-1) ?? 'null');

export const run = (...args: ReadonlyArray<string>) =>
  Effect.runPromise(
    Command.runWith(rota, { version: 'test' })(args).pipe(
      Effect.updateService(FileSystem.FileSystem, (real) =>
        cli.fileSystem(real),
      ),
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            [
              `ROTA_SERVER=${origin}`,
              `XDG_CONFIG_HOME=${join(cli.home, 'config')}`,
              `XDG_CACHE_HOME=${join(cli.home, 'cache')}`,
            ].join('\n'),
          ),
        ),
      ),
      Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
      Effect.result,
    ),
  );

export const runOk = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Failure') {
    throw new Error(`rota ${args.join(' ')} failed: ${result.failure}`);
  }
};

export const failureOf = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Success') {
    throw new Error(`rota ${args.join(' ')} succeeded`);
  }
  return result.failure;
};

/** Gives a test a signed-in home of its own and captures the CLI's output; run before each test. */
export const startCommandTest = async () => {
  cli.sent = [];
  cli.answer = () => Response.json(dayView);
  cli.fileSystem = (real) => real;
  cli.home = await mkdtemp(join(tmpdir(), 'rota-cli-'));
  await Bun.write(
    join(cli.home, 'config', 'rota', 'sessions.json'),
    JSON.stringify({ [origin]: { token } }),
  );
  written = [];
  process.stdout.write = ((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
};

/** Restores stdout and removes the test's home; run after each test. */
export const endCommandTest = async () => {
  process.stdout.write = realWrite;
  await rm(cli.home, { recursive: true, force: true });
};
