import { defineConfig } from 'astro/config';

// Static one-page marketing site. Output to dist/ for Firebase Hosting.
export default defineConfig({
  site: 'https://clippy.parthjansari.dev',
  build: { format: 'file' },
});
