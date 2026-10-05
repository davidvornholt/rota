import { createA11yPlaywrightConfig } from '@davidvornholt/a11y-testing/playwright-config';
import { fixtureOrigin, fixtureReadyPath } from './a11y/fixture-origin.ts';

const config = createA11yPlaywrightConfig({
  baseUrl: 'http://127.0.0.1:3110',
  webServerCommand: 'bun --env-file=.env.a11y run start',
});

export default {
  ...config,
  webServer: [
    ...[config.webServer ?? []].flat(),
    {
      // One fixture server for every worker. Tests start once its
      // dependencies are pre-bundled, so no test pays for a cold optimizer.
      command: 'bunx vite --config a11y/vite.config.ts',
      url: new URL(fixtureReadyPath, fixtureOrigin).href,
      reuseExistingServer: false,
      // Pre-bundling from scratch took about three and a half minutes during a
      // full local gate on a busy machine. This budget covers server start
      // only, not tests.
      timeout: 300_000,
    },
  ],
};
