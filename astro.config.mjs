import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Set this to your production origin (no trailing slash). Used to build
// absolute URLs for Open Graph / Twitter share cards and canonical links.
// You can also override at build time via the PUBLIC_SITE_URL env var.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://thebrownlinechi.com';
const BASE = SITE.includes('github.io') ? '/Brown-Line-Website/' : '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      // Admin pages are already noindex'd via meta; this filter is belt
      // and braces so they never show up in the sitemap either. /standards is
      // a redirect stub to an /about anchor, so it stays out too. /support is
      // a real page again (Keep the Line Running) and belongs in the sitemap.
      filter: (page) =>
        !page.includes('/admin/') &&
        !page.includes('/link-unavailable') &&
        !/\/standards\/?$/.test(page),
    }),
  ],
});
