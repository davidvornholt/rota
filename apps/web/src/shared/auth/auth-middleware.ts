import { createMiddleware } from '@tanstack/react-start';
import {
  getRequest,
  getResponseHeaders,
  setResponseStatus,
} from '@tanstack/react-start/server';
import { asIdentity, type Identity } from './identity.ts';
import { applyPrivateResponseHeaders } from './private-response.ts';
import { authorizedIdentity } from './session.ts';
import { runSessionRequired } from './session-required.ts';

/** Attach to every server function that reads or writes wardrobe data. */
export const sessionRequired = createMiddleware().server(({ next }) => {
  const request = getRequest();
  let identity: Identity | null = null;
  return runSessionRequired({
    transport: 'server-function',
    authorize: async () => {
      identity = await authorizedIdentity(request.headers);
      return identity !== null;
    },
    next: async () => {
      if (!identity) {
        throw new Error('Missing identity.');
      }
      return await asIdentity(identity, () => next());
    },
    publishHeaders: () => applyPrivateResponseHeaders(getResponseHeaders()),
    publishStatus: (status) => setResponseStatus(status),
  });
});
