import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { runSessionRequired } from './session-required.ts';

const conflict = 409;
const unauthorized = 401;
const seeOther = 303;

const conflictFailure = {
  _tag: 'ProposalStateError',
  message: 'That proposal has already been decided. Reload to see today.',
  httpStatus: conflict,
} as const;

const call = <T>(
  transport: 'server-function' | 'route',
  authorize: () => Promise<boolean>,
  next: () => Promise<T>,
) => {
  const publishStatus = mock((_status: number) => undefined);
  return {
    result: runSessionRequired({
      transport,
      authorize,
      next,
      publishHeaders: () => undefined,
      publishStatus,
    }),
    publishStatus,
  };
};

describe('runSessionRequired for a server function', () => {
  it('rejects SSR function failures with serializable safe errors without requiring a client RPC header', async () => {
    const { result, publishStatus } = call(
      'server-function',
      () => Promise.resolve(true),
      () => Effect.runPromise(Effect.fail(conflictFailure)),
    );

    const error = await result.catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(conflictFailure.message);
    expect(publishStatus).toHaveBeenCalledWith(conflict);
  });

  it('rejects an unauthorized call with an Error instead of a redirect', async () => {
    const { result, publishStatus } = call(
      'server-function',
      () => Promise.resolve(false),
      () => Promise.resolve('sensitive data'),
    );

    const error = await result.catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Not authorized.');
    expect(publishStatus).toHaveBeenCalledWith(unauthorized);
  });

  it('passes a successful answer through untouched', async () => {
    const { result, publishStatus } = call(
      'server-function',
      () => Promise.resolve(true),
      () => Promise.resolve({ today: '2026-09-07' }),
    );

    expect(await result).toEqual({ today: '2026-09-07' });
    expect(publishStatus).not.toHaveBeenCalled();
  });
});

describe('runSessionRequired for a route handler', () => {
  it('answers an unauthorized page-style request with the sign-in redirect', async () => {
    const { result } = call(
      'route',
      () => Promise.resolve(false),
      () => Promise.resolve(new Response('media')),
    );

    const response = await result.catch((error: unknown) => error);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(seeOther);
    expect((response as Response).headers.get('location')).toBe('/login');
  });

  it('keeps other failures as Responses', async () => {
    const { result } = call(
      'route',
      () => Promise.resolve(true),
      () => Effect.runPromise(Effect.fail(conflictFailure)),
    );

    const response = await result.catch((error: unknown) => error);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(conflict);
    expect(await (response as Response).text()).toBe(conflictFailure.message);
  });
});
