import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  site: 'https://barrymichaeldoyle.github.io',
  base: '/convex-inspect',
  integrations: [
    starlight({
      title: 'convex-inspect',
      disable404Route: true,
      description:
        'Dev-time panel for inspecting Convex queries, mutations, and actions without leaving your app.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/barrymichaeldoyle/convex-inspect',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        ThemeSelect: './src/components/EmptyThemeSelect.astro',
      },
      head: [
        {
          tag: 'script',
          attrs: {},
          content: `(function(){try{localStorage.setItem('starlight-theme','dark');}catch(e){}document.documentElement.dataset.theme='dark';})();`,
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          link: '/getting-started/',
        },
        {
          label: 'API Reference',
          items: [
            { label: 'ConvexPanel', link: '/api/components/' },
            { label: 'Hooks', link: '/api/hooks/' },
            { label: 'Event Bus', link: '/api/event-bus/' },
          ],
        },
      ],
    }),
    react(),
  ],
  vite: {
    resolve: {
      alias: {
        'convex-inspect/react': fileURLToPath(
          new URL('../../packages/core/src/react.tsx', import.meta.url),
        ),
        'convex-inspect': fileURLToPath(
          new URL('../../packages/core/src/index.ts', import.meta.url),
        ),
      },
    },
  },
});
