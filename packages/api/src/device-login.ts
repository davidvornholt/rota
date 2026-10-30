/**
 * The OAuth device authorization grant (RFC 8628) a client uses to sign in.
 * Better Auth serves these endpoints under `/api/auth`; the approval page is
 * `/device` in the web app.
 */
export const deviceClientId = 'rota-cli';
export const deviceCodePath = '/api/auth/device/code';
export const deviceTokenPath = '/api/auth/device/token';
export const deviceGrantType = 'urn:ietf:params:oauth:grant-type:device_code';
export const signOutPath = '/api/auth/sign-out';
