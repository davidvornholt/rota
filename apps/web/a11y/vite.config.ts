// Serves the pages in a11y/fixtures with React and the real theme without
// bypassing authentication or adding test routes to the production application.
// Playwright starts one server with this config for the whole run and waits for
// the ready path, so every worker shares one server whose dependencies are
// already pre-bundled.
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { fixturePort, fixtureReadyPath } from './fixture-origin.ts';

const fixtureModule = (file: string) =>
  new URL(`./fixtures/${file}`, import.meta.url).pathname;

const pendingOptimization = (server: ViteDevServer) =>
  Object.values(
    server.environments.client.depsOptimizer?.metadata.discovered ?? {},
  ).flatMap(({ processing }) => (processing === undefined ? [] : [processing]));

// Wait for the dependency scan, then for optimizer batches until none is pending.
const settleOptimization = async (server: ViteDevServer): Promise<void> => {
  await server.environments.client.depsOptimizer?.scanProcessing;
  const pending = pendingOptimization(server);
  if (pending.length > 0) {
    await Promise.all(pending);
    await settleOptimization(server);
  }
};

const readiness = (): Plugin => {
  let dependenciesOptimized = false;
  return {
    name: 'a11y-fixture-readiness',
    configureServer: (server) => {
      // The optimizer starts its scan before the port opens.
      server.httpServer?.once('listening', async () => {
        await settleOptimization(server);
        dependenciesOptimized = true;
      });
      server.middlewares.use(fixtureReadyPath, (_request, response) => {
        // Playwright treats 503 as not ready yet and keeps polling.
        response.statusCode = dependenciesOptimized ? 204 : 503;
        response.end();
      });
    },
  };
};

export default defineConfig({
  root: new URL('..', import.meta.url).pathname,
  cacheDir: 'node_modules/.vite-a11y-fixtures',
  optimizeDeps: {
    // Scan every fixture page before the first test, so no page load finds a
    // dependency late and triggers a re-bundle and full reload.
    entries: ['a11y/fixtures/*.html'],
    // Pre-bundle from the current fixtures on every run, not from an earlier
    // run's cache.
    force: true,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '#/shared/auth/session-fn.ts': fixtureModule('session-fns.ts'),
      '../services/people-fns.ts': fixtureModule('people-fns.ts'),
      '../services/settings-fns.ts': fixtureModule('settings-fns.ts'),
      '../services/planning-fns.ts': fixtureModule('planning-fns.ts'),
      '../services/today-fns.ts': fixtureModule('garments-fns.ts'),
      './garments-fns.ts': fixtureModule('garments-fns.ts'),
      '../services/garments-fns.ts': fixtureModule('garments-fns.ts'),
    },
  },
  plugins: [readiness(), tailwindcss(), viteReact()],
  server: { host: '127.0.0.1', port: fixturePort, strictPort: true },
});
