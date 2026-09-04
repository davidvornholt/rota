import { Cause, Option, ParseResult, Runtime } from 'effect';

export const privateResponseHeaders = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
} as const;

const approvedPrivateResponses = new WeakSet<Response>();

/** Marks a non-OK response the authenticated boundary may pass through as-is. */
export const approvePrivateResponse = (response: Response): Response => {
  approvedPrivateResponses.add(response);
  return response;
};

export const isApprovedPrivateResponse = (response: Response): boolean =>
  approvedPrivateResponses.has(response);

export const applyPrivateResponseHeaders = (
  headers: Pick<Headers, 'set'>,
): void => {
  headers.set('cache-control', privateResponseHeaders['cache-control']);
  headers.set('pragma', privateResponseHeaders.pragma);
  headers.set(
    'x-content-type-options',
    privateResponseHeaders['x-content-type-options'],
  );
};

const failureOf = (error: unknown): unknown => {
  if (!Runtime.isFiberFailure(error)) {
    return error;
  }
  const failure = Cause.failureOption(error[Runtime.FiberFailureCauseId]);
  return Option.isSome(failure) ? failure.value : error;
};

type SafeFailure = {
  readonly message: string;
  readonly status: number;
};

const minimumClientError = 400;
const maximumClientError = 499;

/**
 * A tagged error that names its own HTTP status has declared its message safe
 * for the browser: those are the expected, user-correctable failures. Anything
 * else is an operational detail and stays on the server.
 */
const taggedSafeFailure = (error: unknown): SafeFailure | undefined => {
  const failure = failureOf(error);
  if (
    typeof failure !== 'object' ||
    failure === null ||
    !('_tag' in failure) ||
    !('message' in failure) ||
    typeof failure.message !== 'string' ||
    !('httpStatus' in failure) ||
    typeof failure.httpStatus !== 'number'
  ) {
    return undefined;
  }
  const { httpStatus } = failure;
  if (httpStatus < minimumClientError || httpStatus > maximumClientError) {
    return undefined;
  }
  return { message: failure.message, status: httpStatus };
};

export const privateFailureResponse = (error: unknown): Response => {
  if (ParseResult.isParseError(failureOf(error))) {
    return new Response('Invalid request.', {
      status: 400,
      headers: privateResponseHeaders,
    });
  }

  const safeFailure = taggedSafeFailure(error);
  if (safeFailure !== undefined) {
    return new Response(safeFailure.message, {
      status: safeFailure.status,
      headers: privateResponseHeaders,
    });
  }

  return new Response('The request could not be completed.', {
    status: 500,
    headers: privateResponseHeaders,
  });
};

export const unauthorizedPrivateResponse = (): Response =>
  new Response('Not authorized.', {
    status: 401,
    headers: privateResponseHeaders,
  });

export const signInPrivateRedirect = (): Response =>
  new Response(null, {
    status: 303,
    headers: { ...privateResponseHeaders, location: '/login' },
  });
