import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

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
    react(),
  ],
});
