import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // nim is linked locally. Deduping prevents its development React from
    // becoming a second renderer in the console.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    emptyOutDir: true,
    outDir: '../internal/web/static',
  },
  server: {
    port: 5284,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8084', changeOrigin: true },
      '/healthz': { target: 'http://127.0.0.1:8084', changeOrigin: true },
      '/readyz': { target: 'http://127.0.0.1:8084', changeOrigin: true },
    },
  },
})
