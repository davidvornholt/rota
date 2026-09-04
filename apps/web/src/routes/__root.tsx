import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';

import { applicationStyleSheetHrefs } from '#/shared/ui/application-style-sheets.ts';
import { viewportContent } from '#/shared/ui/viewport.ts';

type RouterContext = {
  readonly queryClient: QueryClient;
};

const RootDocument = ({ children }: { readonly children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      {children}
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: viewportContent },
      { title: 'Rota' },
      {
        name: 'description',
        content:
          'Rota — what to wear today, from a wardrobe that keeps its own rotation.',
      },
      { name: 'theme-color', content: '#fafafb' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Rota' },
    ],
    links: [
      ...applicationStyleSheetHrefs.map((href) => ({
        rel: 'stylesheet',
        href,
      })),
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
});
