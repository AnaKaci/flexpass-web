import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages uses a project subpath. Docker/Render and local builds use /.
// The Pages workflow runs: npm run build -- --mode pages
export default defineConfig(({ mode }) => {
  const githubPages = mode === 'pages';
  return {
    base: githubPages ? '/flexpass-web/' : '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
    },
    build: { outDir: 'dist', sourcemap: !githubPages },
  };
});
