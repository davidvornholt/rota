import { createStart } from '@tanstack/react-start';

import { signedInFetch } from '#/shared/runtime/server-function-fetch.ts';

export const startInstance = createStart(() => ({
  serverFns: { fetch: signedInFetch },
}));
