import { Cause, Effect } from 'effect';

/** Keep thrown auth/storage failures out of the framework's Node response adapter. */
export const authResponse = (
  work: () => Promise<Response>,
): Promise<Response> =>
  Effect.runPromise(
    Effect.tryPromise(work).pipe(
      Effect.catchAll((error) =>
        Effect.logError(
          'Authentication request failed.',
          Cause.die(error),
        ).pipe(
          Effect.as(
            Response.json(
              {
                code: 'AUTH_UNAVAILABLE',
                message:
                  'Sign-in is temporarily unavailable. Please try again.',
              },
              { status: 503 },
            ),
          ),
        ),
      ),
    ),
  );
