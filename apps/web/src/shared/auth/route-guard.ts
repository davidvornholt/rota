import { hasAuthorizedSession } from './session.ts';
import { runSessionRequired } from './session-required.ts';

/**
 * The authenticated boundary for a server route handler. A thrown Response
 * (401, or the sign-in redirect for a page-style request) becomes the answer.
 */
export const guardedRoute =
  <Params>(handle: (request: Request, params: Params) => Promise<Response>) =>
  async ({
    request,
    params,
  }: {
    readonly request: Request;
    readonly params: Params;
  }): Promise<Response> => {
    try {
      return await runSessionRequired({
        request,
        authorize: () => hasAuthorizedSession(request.headers),
        next: () => handle(request, params),
        publishHeaders: () => undefined,
        publishStatus: () => undefined,
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      throw error;
    }
  };
