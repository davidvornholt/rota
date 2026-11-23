import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';
import { serverFunctionFetch, signedInFetch } from './server-function-fetch.ts';

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());
const ok = 200;
const unauthorized = 401;
const forbidden = 403;
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

describe('signedInFetch', () => {
  const assign = mock();
  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(globalThis, 'location', {
      value: { assign },
      configurable: true,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'location');
  });

  it('sends the tab to sign in once the session has ended', async () => {
    const response = new Response('Not authorized.', { status: unauthorized });
    fetchSpy.mockResolvedValue(response);
    expect(await signedInFetch('https://rota.test/_serverFn/test')).toBe(
      response,
    );
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('also covers calls made through serverFunctionFetch', async () => {
    fetchSpy.mockResolvedValue(
      new Response('"Not authorized."', {
        status: unauthorized,
        headers: {
          'content-type': 'application/json',
          'x-tss-serialized': 'true',
        },
      }),
    );
    await serverFunctionFetch('https://rota.test/_serverFn/test');
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it.each([ok, forbidden, conflict])(
    'keeps the tab where it is for status %s',
    async (status) => {
      fetchSpy.mockResolvedValue(new Response('{}', { status }));
      await signedInFetch('https://rota.test/_serverFn/test');
      expect(assign).not.toHaveBeenCalled();
    },
  );
});
