import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages hosts the site under /flexpass-web/; Docker/Render use /.
const githubPages = process.env.VITE_GITHUB_PAGES === 'true';
export default defineConfig({
  base: githubPages ? '/flexpass-web/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: !githubPages },
});
