import { Effect, Schema } from 'effect';

class ServerRequestError extends Schema.TaggedError<ServerRequestError>()(
  'ServerRequestError',
  { message: Schema.String },
) {}

const unauthorized = 401;

/**
 * On a signed-in page, a 401 means the session has ended. A page load of sign-in,
 * not a router navigation, drops everything this tab still holds.
 */
export const signInIfSessionEnded = (status: number) => {
  if (status === unauthorized) {
    globalThis.location.assign('/login');
  }
};

export const signedInFetch = async (
  ...args: Parameters<typeof fetch>
): Promise<Response> => {
  const response = await fetch(...args);
  signInIfSessionEnded(response.status);
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
