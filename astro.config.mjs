// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://jordonkloiber.com',
  integrations: [sitemap()],
  build: {
    // Always inline CSS-- the whole stylesheet is one small file with
    // no scenario where part of it should be external. Explicit so this
    // doesn't silently depend on staying under Vite's 4KB auto-inline
    // threshold as the CSS grows.
    inlineStylesheets: 'always',
  },
});