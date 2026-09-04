import { createMiddleware } from '@tanstack/react-start';
import { getRequest, getResponseHeaders } from '@tanstack/react-start/server';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { hasAuthorizedSession } from './session.ts';
import { runSessionRequired } from './session-required.ts';

/** Attach to every server function or route handler that reads or writes wardrobe data. */
export const sessionRequired = createMiddleware().server(({ next }) => {
  const request = getRequest();
  return runSessionRequired({
    request,
    authorize: () => hasAuthorizedSession(request.headers),
    next: async () => next(),
    publishHeaders: () => applyPrivateResponseHeaders(getResponseHeaders()),
  });
});
