import {
  isApprovedPrivateResponse,
  privateFailureResponse,
  unauthorizedPrivateResponse,
} from './private-response.ts';

type ProtectedCall<T> = {
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
  readonly publishHeaders: () => void;
};

const returnedResponse = (value: unknown): Response | undefined => {
  if (value instanceof Response) {
    return value;
  }
  if (typeof value !== 'object' || value === null || !('result' in value)) {
    return undefined;
  }
  return value.result instanceof Response ? value.result : undefined;
};

/**
 * Runs `next` only for an authorized caller. TanStack Start turns a thrown
 * `Response` into the server-function response, so an unauthorized call ends as
 * a 401 without the protected operation ever running.
 */
export const runProtectedCall = async <T>({
  authorize,
  next,
  publishHeaders,
}: ProtectedCall<T>): Promise<T> => {
  publishHeaders();

  let authorized: boolean;
  try {
    authorized = await authorize();
  } catch (error) {
    throw privateFailureResponse(error);
  }

  if (!authorized) {
    throw unauthorizedPrivateResponse();
  }

  try {
    const result = await next();
    const response = returnedResponse(result);
    if (response !== undefined && !response.ok) {
      if (isApprovedPrivateResponse(response)) {
        return result;
      }
      throw response;
    }
    return result;
  } catch (error) {
    if (error instanceof Response && isApprovedPrivateResponse(error)) {
      throw error;
    }
    throw privateFailureResponse(error);
  }
};
