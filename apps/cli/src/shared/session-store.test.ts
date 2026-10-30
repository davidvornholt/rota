import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BunServices } from '@effect/platform-bun';
import { ConfigProvider, Effect, Option } from 'effect';
import { forgetToken, readToken, saveToken } from './session-store.ts';

let home = '';

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'rota-sessions-'));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

const run = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            `XDG_CONFIG_HOME=${join(home, 'config')}`,
          ),
        ),
      ),
    ),
  );

/** The permission bits as `ls -l` counts them, such as `600`. */
const permissions = (stats: { readonly mode: number }) =>
  stats.mode.toString(8).slice(-3);

const sessionsFile = () => join(home, 'config', 'rota', 'sessions.json');

describe('the session store', () => {
  it('has no token before the first sign-in', async () => {
    expect(await run(readToken('https://rota.example.com'))).toEqual(
      Option.none(),
    );
  });

  it('keeps one token per server, readable only by the owner', async () => {
    await run(saveToken('https://rota.example.com', 'first'));
    await run(saveToken('http://localhost:3000', 'local'));
    await run(saveToken('https://rota.example.com', 'second'));
    expect(await run(readToken('https://rota.example.com'))).toEqual(
      Option.some('second'),
    );
    expect(await run(readToken('http://localhost:3000'))).toEqual(
      Option.some('local'),
    );
    expect(permissions(await stat(sessionsFile()))).toBe('600');
    expect(permissions(await stat(join(home, 'config', 'rota')))).toBe('700');
  });

  it('forgets one server and keeps the others', async () => {
    await run(saveToken('https://rota.example.com', 'remote'));
    await run(saveToken('http://localhost:3000', 'local'));
    await run(forgetToken('https://rota.example.com'));
    await run(forgetToken('https://rota.example.com'));
    expect(await run(readToken('https://rota.example.com'))).toEqual(
      Option.none(),
    );
    expect(await run(readToken('http://localhost:3000'))).toEqual(
      Option.some('local'),
    );
  });

  it('reports a sessions file it cannot read', async () => {
    await run(saveToken('https://rota.example.com', 'remote'));
    await Bun.write(sessionsFile(), 'not json');
    const failure = await run(
      readToken('https://rota.example.com').pipe(Effect.flip),
    );
    expect(failure._tag).toBe('SessionStoreFailed');
  });
});
