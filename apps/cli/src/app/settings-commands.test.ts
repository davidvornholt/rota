import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cli,
  endCommandTest,
  failureOf,
  runOk,
  startCommandTest,
} from './command-harness.ts';

beforeEach(startCommandTest);
afterEach(endCommandTest);

const shown = {
  location: 'Kirchheim, Germany',
  laundryDays: 4,
  cooldownDays: 7,
  proposalHour: 5,
  cleanTopFrom: null,
  styleNote: '',
  wearBudgets: { jumper: 6 },
};

describe('rota settings', () => {
  it('shows the settings and sends only the ones a change names', async () => {
    cli.answer = () => Response.json(shown);
    await runOk('settings', 'show');
    await runOk(
      'settings',
      'set',
      '--wear-budget',
      'jumper=6',
      '--wear-budget',
      'shirt=default',
      '--clean-top-from',
      'none',
      '--laundry-days',
      '3',
      '--style-note',
      'Smart casual most days.',
    );
    expect(
      cli.sent.map(({ method, path, body }) => [method, path, body]),
    ).toEqual([
      ['GET', '/api/cli/settings', undefined],
      [
        'PUT',
        '/api/cli/settings',
        {
          laundryDays: 3,
          cleanTopFrom: null,
          styleNote: 'Smart casual most days.',
          wearBudgets: { jumper: 6, shirt: null },
        },
      ],
    ]);
  });

  it('rejects an empty or malformed change before asking the server', async () => {
    const malformed = [
      [],
      ['--wear-budget', 'jumper'],
      ['--wear-budget', 'jumper=lots'],
      ['--wear-budget', '=6'],
      ['--proposal-hour', 'dawn'],
      ['--clean-top-from', 'Monday'],
    ];
    const failures = await Promise.all(
      malformed.map((flags) => failureOf('settings', 'set', ...flags)),
    );
    expect(failures.map((failure) => failure._tag)).toEqual(
      malformed.map(() => 'InvalidInput'),
    );
    expect(cli.sent).toEqual([]);
  });
});
