const signOutPath = '/api/auth/sign-out';

/**
 * Garment pictures are cached in the browser (see the media route). A
 * successful sign-out tells the browser to drop its cache for the site, so a
 * shared device keeps no pictures once its user has left. Browsers without
 * `Clear-Site-Data` keep them until they expire.
 */
export const clearCacheOnSignOut = (
  request: Request,
  response: Response,
): Response => {
  if (!response.ok || new URL(request.url).pathname !== signOutPath) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('clear-site-data', '"cache"');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
