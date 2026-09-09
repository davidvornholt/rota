import { Data, Effect } from 'effect';

class ServerRequestError extends Data.TaggedError('ServerRequestError')<{
  readonly message: string;
}> {}

/** Reject proxy failures before TanStack tries to decode them as RPC results. */
export const serverFunctionFetch = (...args: Parameters<typeof fetch>) =>
  Effect.runPromise(
    Effect.tryPromise({
      try: () => fetch(...args),
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
