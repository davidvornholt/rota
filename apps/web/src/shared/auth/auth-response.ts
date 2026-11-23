import { signInIfSessionEnded } from '#/shared/runtime/server-function-fetch.ts';

export const rejectAuthError = <T extends { readonly error: unknown }>(
  response: T,
): T | Promise<never> =>
  response.error === null ? response : Promise.reject(response.error);

/** Better Auth's calls on signed-in pages don't go through `signedInFetch`. */
export const rejectSignedInAuthError = <
  T extends { readonly error: { readonly status: number } | null },
>(
  response: T,
): T | Promise<never> => {
  if (response.error !== null) {
    signInIfSessionEnded(response.error.status);
  }
  return rejectAuthError(response);
};
