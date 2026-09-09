import { Effect } from 'effect';
import {
  privateFailureResponse,
  privateResponseHeaders,
} from '../src/shared/auth/private-response.ts';

type Handler = (request: Request) => Promise<Response> | Response;

/** Bun's idle timer cannot represent more than 255 seconds. Bound long RPCs here. */
export const runServerFunction = (handler: Handler, request: Request) =>
  Effect.tryPromise({
    try: (signal) =>
      Promise.resolve(
        handler(
          new Request(request, {
            signal: AbortSignal.any([request.signal, signal]),
          }),
        ),
      ),
    catch: privateFailureResponse,
  }).pipe(
    Effect.timeoutFail({
      duration: '420 seconds',
      onTimeout: () =>
        new Response(
          'The request timed out. Refresh to check whether your change completed.',
          {
            status: 504,
            headers: privateResponseHeaders,
          },
        ),
    }),
    Effect.catchAll(Effect.succeed),
  );
