import { describe, expect, it } from 'bun:test';
import { getResponseHeaders } from '@tanstack/react-start/server';

import { privateResponseHeaders } from './private-response.ts';
import { publishPrivateResponseHeaders } from './publish-private-headers.ts';

// Start keeps the running request in this shared AsyncLocalStorage; the helpers throw without it.
const startEventStorage = (
  globalThis as Record<
    symbol,
    { run: <T>(event: object, callback: () => T) => T }
  >
)[Symbol.for('tanstack-start:event-storage')];

describe('publishPrivateResponseHeaders', () => {
  it('puts the private headers on the response of the running request', () => {
    const published = startEventStorage?.run(
      { request: new Request('http://localhost/') },
      () => {
        publishPrivateResponseHeaders();
        return Object.fromEntries(getResponseHeaders());
      },
    );

    expect(published).toEqual(privateResponseHeaders);
  });
});
