import { asIdentity, type Identity } from './identity.ts';
import { authorizedIdentity } from './session.ts';
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
    let identity: Identity | null = null;
    try {
      return await runSessionRequired({
        request,
        authorize: async () => {
          identity = await authorizedIdentity(request.headers);
          return identity !== null;
        },
        next: () => {
          if (!identity) {
            throw new Error('Missing identity.');
          }
          return asIdentity(identity, () => handle(request, params));
        },
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
