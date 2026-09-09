import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { serverFunctionFetch } from './server-function-fetch.ts';

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());
const ok = 200;
const conflict = 409;

describe('serverFunctionFetch', () => {
  it('explains an empty proxy 502 before the RPC decoder sees it', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 502 }));
    await expect(
      serverFunctionFetch('https://rota.test/_serverFn/test'),
    ).rejects.toThrow('Refresh to check your outfit');
  });

  it('explains connection resets without exposing transport internals', async () => {
    fetchSpy.mockRejectedValue(new TypeError('NetworkError'));
    await expect(
      serverFunctionFetch('https://rota.test/_serverFn/test'),
    ).rejects.toThrow('connection to Rota was interrupted');
  });

  it.each([ok, conflict])(
    'preserves serialized success or application failure with status %s',
    async (status) => {
      const response = new Response('{}', {
        status,
        headers: {
          'content-type': 'application/json',
          'x-tss-serialized': 'true',
        },
      });
      fetchSpy.mockResolvedValue(response);
      const abort = new AbortController();
      expect(
        await serverFunctionFetch('https://rota.test/_serverFn/test', {
          signal: abort.signal,
        }),
      ).toBe(response);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://rota.test/_serverFn/test',
        { signal: abort.signal },
      );
    },
  );
});
