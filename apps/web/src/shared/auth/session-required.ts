import { signInPrivateRedirect } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

type SessionRequiredCall<T> = {
  readonly request: Request;
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
  readonly publishHeaders: () => void;
  readonly publishStatus: (status: number) => void;
};

const isServerFunctionRequest = (request: Request): boolean =>
  request.headers.get('x-tsr-serverFn') === 'true';
const unauthorized = 401;

/**
 * Runs the authenticated boundary with transport-appropriate failure recovery.
 * A route handler answers with the Response itself (or the sign-in redirect).
 * A server function must reject instead: TanStack Start hands a thrown
 * Response back to the browser as the call's successful result, so the failure
 * becomes an Error with the already-vetted message and the status goes out on
 * the event.
 */
export const runSessionRequired = async <T>({
  request,
  authorize,
  next,
  publishHeaders,
  publishStatus,
}: SessionRequiredCall<T>): Promise<T> => {
  try {
    return await runProtectedCall({ authorize, next, publishHeaders });
  } catch (error) {
    if (!(error instanceof Response)) {
      throw error;
    }
    if (isServerFunctionRequest(request)) {
      publishStatus(error.status);
      // biome-ignore lint/style/useErrorCause: The Error travels to the browser through seroval, which keeps only its message and cannot carry a Response as the cause.
      throw new Error(await error.text());
    }
    if (error.status === unauthorized) {
      throw signInPrivateRedirect();
    }
    throw error;
  }
};
