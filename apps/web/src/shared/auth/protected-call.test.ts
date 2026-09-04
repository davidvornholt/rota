import { describe, expect, it, mock } from 'bun:test';
import { Effect, Schema } from 'effect';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

const badRequest = 400;
const unauthorized = 401;
const conflict = 409;
const internalServerError = 500;
const expectedPrivateHeaders = {
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
};

const privateHeadersOf = (headers: Headers) => ({
  cacheControl: headers.get('cache-control'),
  pragma: headers.get('pragma'),
  contentTypeOptions: headers.get('x-content-type-options'),
});

const responseFrom = async (promise: Promise<unknown>): Promise<Response> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the protected call to reject with a Response.');
};

const protectedCall = <T>(
  authorize: () => Promise<boolean>,
  next: () => Promise<T>,
) => {
  const publishedHeaders = new Headers();
  const publishHeaders = mock(() =>
    applyPrivateResponseHeaders(publishedHeaders),
  );
  return {
    result: runProtectedCall({ authorize, next, publishHeaders }),
    publishHeaders,
    publishedHeaders,
  };
};

/** Shapes, not classes: the boundary reads `_tag`, `message`, and `httpStatus` off whatever failed. */
const safeConflict = {
  _tag: 'SafeConflict',
  message: 'That day already has a top.',
  httpStatus: conflict,
} as const;

const operationalFailure = {
  _tag: 'OperationalFailure',
  message: 'pg: relation is missing',
} as const;

describe('server-function authorization', () => {
  it('rejects with 401 before calling the protected operation', async () => {
    let called = false;
    const { result, publishHeaders, publishedHeaders } = protectedCall(
      () => Promise.resolve(false),
      () => {
        called = true;
        return Promise.resolve('sensitive data');
      },
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(unauthorized);
    expect(await response.text()).toBe('Not authorized.');
    expect(privateHeadersOf(response.headers)).toEqual(expectedPrivateHeaders);
    expect(publishHeaders).toHaveBeenCalledTimes(1);
    expect(privateHeadersOf(publishedHeaders)).toEqual(expectedPrivateHeaders);
    expect(called).toBeFalse();
  });

  it('publishes the private response policy before returning data', async () => {
    const { result, publishHeaders, publishedHeaders } = protectedCall(
      () => Promise.resolve(true),
      () => Promise.resolve('sensitive data'),
    );

    expect(await result).toBe('sensitive data');
    expect(publishHeaders).toHaveBeenCalledTimes(1);
    expect(privateHeadersOf(publishedHeaders)).toEqual(expectedPrivateHeaders);
  });

  it('turns an authorization failure into a generic 500', async () => {
    const { result } = protectedCall(
      () => Promise.reject(new Error('database down: password=hunter2')),
      () => Promise.resolve('sensitive data'),
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(internalServerError);
    expect(await response.text()).toBe('The request could not be completed.');
  });

  it('answers a schema decoding failure with 400 and no detail', async () => {
    const { result } = protectedCall(
      () => Promise.resolve(true),
      () =>
        Effect.runPromise(Schema.decodeUnknown(Schema.Number)('not a number')),
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(badRequest);
    expect(await response.text()).toBe('Invalid request.');
  });

  it('keeps the message of an error that declares its own client status', async () => {
    const { result } = protectedCall(
      () => Promise.resolve(true),
      () => Effect.runPromise(Effect.fail(safeConflict)),
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(conflict);
    expect(await response.text()).toBe('That day already has a top.');
  });

  it('hides the message of an error without a declared client status', async () => {
    const { result } = protectedCall(
      () => Promise.resolve(true),
      () => Effect.runPromise(Effect.fail(operationalFailure)),
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(internalServerError);
    expect(await response.text()).toBe('The request could not be completed.');
  });
});
