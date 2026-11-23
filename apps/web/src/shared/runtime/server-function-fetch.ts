import { Effect, Schema } from 'effect';

class ServerRequestError extends Schema.TaggedError<ServerRequestError>()(
  'ServerRequestError',
  { message: Schema.String },
) {}

const unauthorized = 401;

/**
 * The fetch behind every server function call in the browser. Each server
 * function checks the session itself, so a 401 means the session has ended:
 * signed out elsewhere, expired, or access revoked. The browser then loads the
 * sign-in page, which also drops everything this tab still holds.
 */
export const signedInFetch = async (
  ...args: Parameters<typeof fetch>
): Promise<Response> => {
  const response = await fetch(...args);
  if (response.status === unauthorized) {
    globalThis.location.assign('/login');
  }
  return response;
};

/** Reject proxy failures before TanStack tries to decode them as RPC results. */
export const serverFunctionFetch = (...args: Parameters<typeof fetch>) =>
  Effect.runPromise(
    Effect.tryPromise({
      try: () => signedInFetch(...args),
      catch: () =>
        new ServerRequestError({
          message:
            'The connection to Rota was interrupted. Refresh to check whether your change completed, then try again.',
        }),
    }).pipe(
      Effect.flatMap((response) => {
        if (
          response.headers.has('content-type') &&
          (response.ok || response.headers.get('x-tss-serialized') === 'true')
        ) {
          return Effect.succeed(response);
        }
        return Effect.fail(
          new ServerRequestError({
            message:
              'Rota could not complete the request. Refresh to check your outfit, then try again.',
          }),
        );
      }),
    ),
  );
