import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { garment, shirt } from './command-fixtures.ts';
import {
  cli,
  endCommandTest,
  failureOf,
  runOk,
  startCommandTest,
} from './command-harness.ts';

beforeEach(startCommandTest);
afterEach(endCommandTest);

describe('rota garments accept and edit', () => {
  it('accepts a garment and sends only the fields an edit names', async () => {
    cli.answer = () => Response.json(garment(shirt, 'active'));
    await runOk('garments', 'accept', shirt);
    const flags =
      '--slots top,over --warmth 3 --rain-ok no --wear-budget default --price none';
    await runOk(
      'garments',
      'edit',
      shirt,
      ...flags.split(' '),
      '--brand',
      'Jack & Jones',
    );
    expect(
      cli.sent.map(({ method, path, body }) => [method, path, body]),
    ).toEqual([
      ['PUT', `/api/cli/garments/${shirt}/accepted`, undefined],
      [
        'PUT',
        `/api/cli/garments/${shirt}`,
        {
          slots: ['top', 'over'],
          warmth: 3,
          rainOk: false,
          wearBudget: null,
          price: null,
          brand: 'Jack & Jones',
        },
      ],
    ]);
  });

  it('rejects an empty or malformed edit before asking the server', async () => {
    const malformed = [
      [],
      ['--warmth', 'warm'],
      ['--price', '1e999'],
      ['--slots', 'top,cape'],
      ['--purchased-on', 'May'],
    ];
    const failures = await Promise.all(
      malformed.map((flags) => failureOf('garments', 'edit', shirt, ...flags)),
    );
    expect(failures.map((failure) => failure._tag)).toEqual(
      malformed.map(() => 'InvalidInput'),
    );
    expect(cli.sent).toEqual([]);
  });
});
