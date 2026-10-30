import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { serverOrigin } from './server.ts';

const origin = (value: string) =>
  Effect.runPromise(
    serverOrigin(value).pipe(
      Effect.match({
        onFailure: (error) => error._tag,
        onSuccess: (result) => result,
      }),
    ),
  );

describe('serverOrigin', () => {
  it('keeps only the origin of an https server', async () => {
    expect(await origin('https://rota.example.com/today?x=1')).toBe(
      'https://rota.example.com',
    );
  });

  it('allows plain http only on this machine', async () => {
    expect(await origin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(await origin('http://[::1]:3000/')).toBe('http://[::1]:3000');
    expect(await origin('http://rota.example.com')).toBe('InvalidInput');
  });

  it('rejects text that is not a URL', async () => {
    expect(await origin('rota.example.com')).toBe('InvalidInput');
  });
});
