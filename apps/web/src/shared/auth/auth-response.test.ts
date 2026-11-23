import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rejectSignedInAuthError } from './auth-response.ts';

const unauthorized = 401;
const forbidden = 403;
const failure = (status: number) => ({
  data: null,
  error: { status, message: 'failed' },
});

describe('rejectSignedInAuthError', () => {
  const assign = mock((_url: string) => undefined);
  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { assign },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'location');
  });

  it('sends a page whose session has ended to sign in', async () => {
    await expect(
      rejectSignedInAuthError(failure(unauthorized)),
    ).rejects.toEqual(failure(unauthorized).error);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('leaves the page open after another error', async () => {
    await expect(rejectSignedInAuthError(failure(forbidden))).rejects.toEqual(
      failure(forbidden).error,
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it('passes a successful response through', () => {
    const response = { data: [], error: null };
    expect(rejectSignedInAuthError(response)).toBe(response);
    expect(assign).not.toHaveBeenCalled();
  });
});
