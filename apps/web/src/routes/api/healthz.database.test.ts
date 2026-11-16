import { describe, expect, it } from 'bun:test';
import { env, fileURLToPath, spawn } from 'bun';

const scenarioTimeoutMs = 90_000;

// The scenario needs the real server modules, which read DATABASE_URL once
// when they load, so it runs in a process of its own with a database it makes.
describe.skipIf(!env.DATABASE_URL?.trim())(
  'health route with a real database',
  () => {
    it(
      'runs against migrated PostgreSQL in an isolated process',
      async () => {
        const child = spawn(
          ['bun', 'test', 'src/routes/api/healthz.database-scenario.test.ts'],
          {
            cwd: fileURLToPath(new URL('../../../', import.meta.url)),
            env: { ...env, HEALTHZ_DATABASE_SCENARIO: 'true' },
            stderr: 'pipe',
            stdout: 'pipe',
          },
        );
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        const output = `${stdout}\n${stderr}`;

        expect(exitCode, output).toBe(0);
        expect(output).toContain('1 pass');
      },
      scenarioTimeoutMs,
    );
  },
);
