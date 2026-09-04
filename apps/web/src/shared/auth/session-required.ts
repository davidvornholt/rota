import { signInPrivateRedirect } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

type SessionRequiredCall<T> = {
  readonly request: Request;
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
  readonly publishHeaders: () => void;
};

const isServerFunctionRequest = (request: Request): boolean =>
  request.headers.get('x-tsr-serverFn') === 'true';
const unauthorized = 401;

/** Runs the authenticated boundary with transport-appropriate sign-in recovery. */
export const runSessionRequired = async <T>({
  request,
  authorize,
  next,
  publishHeaders,
}: SessionRequiredCall<T>): Promise<T> => {
  try {
    return await runProtectedCall({ authorize, next, publishHeaders });
  } catch (error) {
    if (
      error instanceof Response &&
      error.status === unauthorized &&
      !isServerFunctionRequest(request)
    ) {
      throw signInPrivateRedirect();
    }
    throw error;
  }
};
