import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { Effect } from 'effect';
import { createServer, type InlineConfig } from 'vite';

const garmentFixtureConfig = (cacheDir: string): InlineConfig => ({
  configFile: false,
  // Each parallel fixture server owns its dependency optimizer cache.
  cacheDir,
  root: new URL('..', import.meta.url).pathname,
  resolve: {
    tsconfigPaths: true,
    alias: {
      '../services/today-fns.ts': new URL(
        './fixtures/garments-fns.ts',
        import.meta.url,
      ).pathname,
      './garments-fns.ts': new URL(
        './fixtures/garments-fns.ts',
        import.meta.url,
      ).pathname,
      '../services/garments-fns.ts': new URL(
        './fixtures/garments-fns.ts',
        import.meta.url,
      ).pathname,
    },
  },
  plugins: [tailwindcss(), viteReact()],
  server: { host: '127.0.0.1', port: 0 },
});

// Exercise the shared form with React and the real theme without bypassing
// authentication or adding test routes to the production application.
export const startGarmentFixtureServer = (cacheDir: string) =>
  Effect.promise(() => createServer(garmentFixtureConfig(cacheDir))).pipe(
    Effect.tap((vite) => Effect.promise(() => vite.listen())),
  );
