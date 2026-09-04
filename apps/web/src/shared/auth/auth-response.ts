export const rejectAuthError = <T extends { readonly error: unknown }>(
  response: T,
): T | Promise<never> =>
  response.error === null ? response : Promise.reject(response.error);
