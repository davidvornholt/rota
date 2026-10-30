import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { FetchHttpClient, type HttpClient } from 'effect/http';
import { httpLayer } from '../../shared/rota-api.ts';
import { awaitApproval, requestDeviceCode } from './device-login.ts';

const origin = 'https://rota.example.com';

type Sent = { readonly path: string; readonly body: unknown };

// Stands in for Rota's auth endpoints: answers each poll with the next of the
// given replies, so no test reaches a server.
const fakeRota = (
  replies: ReadonlyArray<{ status: number; body: unknown }>,
) => {
  const sent: Array<Sent> = [];
  const redirects: Array<RequestRedirect | undefined> = [];
  let next = 0;
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    redirects.push(init?.redirect);
    sent.push({
      path: new URL(request.url).pathname,
      body: await request.json(),
    });
    const reply = replies[Math.min(next, replies.length - 1)];
    next += 1;
    return Response.json(reply?.body, { status: reply?.status ?? 500 });
  }) as typeof globalThis.fetch;
  return { sent, redirects, fetch };
};

const run = <A, E>(
  effect: Effect.Effect<A, E, HttpClient.HttpClient>,
  fetch: typeof globalThis.fetch,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(httpLayer),
      Effect.provideService(FetchHttpClient.Fetch, fetch),
    ),
  );

const code = {
  deviceCode: 'device-1',
  userCode: 'ABCD1234',
  verificationUri: `${origin}/device`,
  verificationUriComplete: `${origin}/device?user_code=ABCD1234`,
  expiresIn: 900,
  interval: 0,
};

const refusal = (fetch: typeof globalThis.fetch, expiresIn = 900) =>
  run(awaitApproval(origin, { ...code, expiresIn }).pipe(Effect.flip), fetch);

describe('device login', () => {
  it('asks for a code as the rota CLI and reads the answer', async () => {
    const rota = fakeRota([
      {
        status: 200,
        body: {
          device_code: 'device-1',
          user_code: 'ABCD1234',
          verification_uri: `${origin}/device`,
          verification_uri_complete: `${origin}/device?user_code=ABCD1234`,
          expires_in: 900,
          interval: 5,
        },
      },
    ]);
    expect(await run(requestDeviceCode(origin), rota.fetch)).toEqual({
      ...code,
      interval: 5,
    });
    expect(rota.sent).toEqual([
      { path: '/api/auth/device/code', body: { client_id: 'rota-cli' } },
    ]);
  });

  it.each([
    'file:///tmp/review',
    'vscode://rota/device?user_code=ABCD1234',
    'https://rota.example.org/device?user_code=ABCD1234',
    'https://someone@rota.example.com/device?user_code=ABCD1234',
  ])('refuses the sign-in link %s', async (link) => {
    const rota = fakeRota([
      {
        status: 200,
        body: {
          device_code: 'device-1',
          user_code: 'ABCD1234',
          verification_uri: `${origin}/device`,
          verification_uri_complete: link,
          expires_in: 900,
          interval: 5,
        },
      },
    ]);
    const failure = await run(
      requestDeviceCode(origin).pipe(Effect.flip),
      rota.fetch,
    );
    expect(failure._tag).toBe('UnexpectedResponse');
  });

  it('polls until the code is approved and returns the session token', async () => {
    const rota = fakeRota([
      { status: 400, body: { error: 'authorization_pending' } },
      { status: 400, body: { error: 'authorization_pending' } },
      { status: 200, body: { access_token: 'token-1', token_type: 'Bearer' } },
    ]);
    expect(await run(awaitApproval(origin, code), rota.fetch)).toBe('token-1');
    expect(rota.sent).toHaveLength(3);
    expect(rota.sent[0]).toEqual({
      path: '/api/auth/device/token',
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'device-1',
        client_id: 'rota-cli',
      },
    });
  });

  it.each([
    ['access_denied', 'The sign-in was denied in the browser.'],
    ['expired_token', 'The code expired'],
  ])('stops when the server answers %s', async (error, message) => {
    const rota = fakeRota([{ status: 400, body: { error } }]);
    const failure = await refusal(rota.fetch);
    expect(failure._tag).toBe('LoginFailed');
    expect(failure.message).toStartWith(message);
  });

  it('reports an error it does not know with the server description', async () => {
    const rota = fakeRota([
      {
        status: 400,
        body: { error: 'invalid_grant', error_description: 'Unknown code' },
      },
    ]);
    const failure = await refusal(rota.fetch);
    expect(failure._tag).toBe('UnexpectedResponse');
    expect(failure.message).toContain('Unknown code');
  });

  it('never follows a redirect, which would carry the device code along', async () => {
    const rota = fakeRota([{ status: 307, body: null }]);
    expect((await refusal(rota.fetch))._tag).toBe('UnexpectedResponse');
    expect(rota.redirects).toEqual(['manual']);
  });

  it('gives up once the code has run out without asking again', async () => {
    const rota = fakeRota([
      { status: 400, body: { error: 'authorization_pending' } },
    ]);
    expect((await refusal(rota.fetch, 0))._tag).toBe('LoginFailed');
    expect(rota.sent).toHaveLength(0);
  });
});
