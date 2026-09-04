import { hasAuthorizedSession } from './session.ts';
import { runSessionRequired } from './session-required.ts';

/**
 * The authenticated boundary for a server route handler. A thrown Response
 * (401, or the sign-in redirect for a page-style request) becomes the answer.
 */
export const guardedRoute =
  (handle: (request: Request) => Promise<Response>) =>
  async ({ request }: { readonly request: Request }): Promise<Response> => {
    try {
      return await runSessionRequired({
        request,
        authorize: () => hasAuthorizedSession(request.headers),
        next: () => handle(request),
        publishHeaders: () => undefined,
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      throw error;
    }
  };
