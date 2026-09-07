import { describe, expect, it } from 'bun:test';

import { privateResponseHeaders } from '../src/shared/auth/private-response.ts';
import { createFetchHandler } from './serve.ts';

const serverFunctionPath = '/_serverFn/test';
const unauthorized = 401;
const conflict = 409;
const frameworkHeader = 'x-framework-header';

const frameworkFailure = (status: number): Response =>
  new Response('serialized failure', {
    status,
    headers: {
      'content-type': 'application/json',
      'x-tss-serialized': 'true',
      [frameworkHeader]: 'preserved',
    },
  });

describe('createFetchHandler', () => {
  it.each([
    ['unauthorized', unauthorized],
    ['safe conflict', conflict],
  ])(
    'preserves the private policy on a %s server-function failure',
    async (_name, status) => {
      const handler = await createFetchHandler(
        new URL('.', import.meta.url).pathname,
        () => frameworkFailure(status),
      );

      const response = await handler(
        new Request(`https://rota.test${serverFunctionPath}`, {
          headers: {
            accept:
              'text/x-component-stream, application/x-ndjson, application/json',
            'sec-fetch-site': 'same-origin',
            'x-tsr-serverFn': 'true',
          },
        }),
      );

      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('x-tss-serialized')).toBe('true');
      expect(response.headers.get(frameworkHeader)).toBe('preserved');
      expect(await response.text()).toBe('serialized failure');
      for (const [name, value] of Object.entries(privateResponseHeaders)) {
        expect(response.headers.get(name)).toBe(value);
      }
    },
  );
});
