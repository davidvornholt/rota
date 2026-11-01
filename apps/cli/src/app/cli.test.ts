import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

let home = '';

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), 'rota-cli-'));
});

afterAll(async () => {
  await rm(home, { recursive: true, force: true });
});

// Runs the real entrypoint, since what reaches stdout and stderr is decided
// there, around the CLI library.
const rota = async (...args: ReadonlyArray<string>) => {
  const child = Bun.spawn(
    [process.execPath, join(import.meta.dir, 'cli.ts'), ...args],
    {
      // Built from entries because environment variable names are not
      // camelCase, and nothing from the caller's environment leaks in.
      env: Object.fromEntries([
        ['HOME', home],
        ['XDG_CONFIG_HOME', join(home, 'config')],
        ['XDG_CACHE_HOME', join(home, 'cache')],
        ['NO_COLOR', '1'],
      ]),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
};

describe('rota on the command line', () => {
  it.each(['--bogus', 'garments get', '--log-level invalid'])(
    'reports `rota %s` as one JSON error and prints no help',
    async (command) => {
      const result = await rota(...command.split(' '));
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(JSON.parse(result.stderr)).toEqual({
        error: { tag: 'UsageError', message: expect.any(String) },
      });
    },
  );

  it.each(['--help', 'garments'])(
    'prints help for `rota %s`',
    async (command) => {
      const result = await rota(...command.split(' '));
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('USAGE');
      expect(result.stderr).toBe('');
    },
  );
});
