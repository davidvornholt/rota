import { describe, expect, it } from 'bun:test';
// biome-ignore lint/correctness/noNodejsModules: This test runs only under Bun and passes the process environment on to a child test run.
import process from 'node:process';
import { fileURLToPath, spawn } from 'bun';

const scenarioTimeoutMs = 90_000;

// The scenario needs the real server modules, which read DATABASE_URL once
// when they load, so it runs in a process of its own with a database it makes.
describe.skipIf(!process.env.DATABASE_URL?.trim())(
  'invitations with a real database',
  () => {
    it(
      'runs against migrated PostgreSQL in an isolated process',
      async () => {
        const child = spawn(
          [
            'bun',
            'test',
            'src/features/people/services/people-service.database-scenario.test.ts',
          ],
          {
            cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
            env: {
              ...process.env,
              ...Object.fromEntries([['PEOPLE_DATABASE_SCENARIO', 'true']]),
            },
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
        expect(output).toContain('6 pass');
      },
      scenarioTimeoutMs,
    );
  },
);
