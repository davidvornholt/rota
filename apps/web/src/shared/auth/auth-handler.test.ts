import { expect, it } from 'bun:test';

import { authResponse } from './auth-handler.ts';

const unavailable = 503;

it('preserves successful responses and redirects including cookies', async () => {
  const response = new Response(null, {
    status: 302,
    headers: { location: '/', 'set-cookie': 'fixture=value; HttpOnly' },
  });
  expect(await authResponse(() => Promise.resolve(response))).toBe(response);
});

it('turns thrown storage errors into an actual sanitized error response', async () => {
  const response = await authResponse(() =>
    Promise.reject(new Error('private database fixture detail')),
  );
  expect(response).toBeInstanceOf(Response);
  expect(response.status).toBe(unavailable);
  expect(await response.json()).toEqual({
    code: 'AUTH_UNAVAILABLE',
    message: 'Sign-in is temporarily unavailable. Please try again.',
  });
});
