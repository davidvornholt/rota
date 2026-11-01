import { expect, it } from 'bun:test';
import {
  deviceClientId,
  deviceCodePath,
  deviceGrantType,
  deviceTokenPath,
} from '@rota/api/device-login';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { commitsAuthAnswer } from './auth-commit.ts';
import { createAuthOptions } from './auth-options.ts';

const origin = 'http://localhost:3100';
const tables: Record<string, Array<unknown>> = {
  account: [],
  deviceCode: [],
  session: [],
  user: [],
  verification: [],
};
const auth = betterAuth({
  ...createAuthOptions({
    allowedGitHubAccountId: '123',
    baseURL: origin,
    githubClientId: 'fixture-client',
    githubClientSecret: 'fixture-secret',
    secret: 'auth-commit-public-fixture-secret-123456',
  }),
  database: memoryAdapter(tables),
});

/** Stands in for the access transaction: an answer it does not commit leaves the tables as they were. */
const send = async (path: string, body: Record<string, string>) => {
  const request = new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const before = structuredClone(tables);
  const response = await auth.handler(request);
  if (!(await commitsAuthAnswer(request, response))) {
    Object.assign(tables, before);
  }
  return response.json();
};

it('tells a device that polls again before its interval to slow down', async () => {
  const { device_code: deviceCode } = await send(deviceCodePath, {
    client_id: deviceClientId,
  });
  const poll = {
    grant_type: deviceGrantType,
    device_code: deviceCode,
    client_id: deviceClientId,
  };
  expect(await send(deviceTokenPath, poll)).toMatchObject({
    error: 'authorization_pending',
  });
  expect(await send(deviceTokenPath, poll)).toMatchObject({
    error: 'slow_down',
  });
});
