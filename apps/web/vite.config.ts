import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config = defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          // Keep @rota/db external so the server bundle imports it through the
          // declared workspace dependency at runtime. Inlining its source would
          // re-resolve its own dependencies (effect, pg) against this app's
          // node_modules, where they are deliberately not declared.
          external: (id) => id.startsWith('@rota/db'),
        },
      },
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
