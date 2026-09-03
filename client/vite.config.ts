import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base: the same build works on a GitHub Pages project subpath
  // (/p5plot/), on a custom domain and from file://. Routing is hash-based,
  // so no server rewrite rules are needed either.
  base: './',
  server: { host: true },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
