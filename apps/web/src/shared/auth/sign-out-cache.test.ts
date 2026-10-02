import { describe, expect, it } from 'bun:test';
import { clearCacheOnSignOut } from './sign-out-cache.ts';

const ok = 200;
const unauthorized = 401;
const origin = 'https://rota.test';

const answer = (status: number) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append('set-cookie', 'session=; Max-Age=0; Path=/');
  headers.append('set-cookie', 'session_data=; Max-Age=0; Path=/');
  return new Response('{"success":true}', { status, headers });
};

describe('clearing the browser cache on sign-out', () => {
  it('asks the browser to drop its cache and keeps the cookie removals', async () => {
    const response = clearCacheOnSignOut(
      new Request(`${origin}/api/auth/sign-out`, { method: 'POST' }),
      answer(ok),
    );
    expect(response.status).toBe(ok);
    expect(response.headers.get('clear-site-data')).toBe('"cache"');
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(await response.text()).toBe('{"success":true}');
  });

  it('leaves a failed sign-out as it is', () => {
    const failed = answer(unauthorized);
    expect(
      clearCacheOnSignOut(
        new Request(`${origin}/api/auth/sign-out`, { method: 'POST' }),
        failed,
      ),
    ).toBe(failed);
  });

  it('leaves every other auth answer as it is', () => {
    const session = answer(ok);
    expect(
      clearCacheOnSignOut(
        new Request(`${origin}/api/auth/get-session`),
        session,
      ),
    ).toBe(session);
  });
});
