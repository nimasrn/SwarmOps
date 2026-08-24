import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const localAPITarget = 'http://127.0.0.1:8084'

// This value is deliberately consumed only by Vite's development server. The
// browser continues to call relative paths, so a local UI can use the deployed
// control-plane API without exposing CORS or credential configuration in the
// client bundle.
export function resolveAPIProxyTarget(value?: string) {
  const configured = value?.trim() || localAPITarget
  let target: URL
  try {
    target = new URL(configured)
  } catch {
    throw new Error('SWARMOPS_API_URL must be an absolute HTTP(S) origin')
  }
  if (
    (target.protocol !== 'http:' && target.protocol !== 'https:')
    || target.username
    || target.password
    || target.pathname !== '/'
    || target.search
    || target.hash
  ) {
    throw new Error('SWARMOPS_API_URL must be an HTTP(S) origin without credentials, a path, query, or fragment')
  }
  if (target.protocol !== 'https:' && !isLoopback(target.hostname)) {
    throw new Error('SWARMOPS_API_URL must use HTTPS unless it targets loopback')
  }
  return target.origin
}

function isLoopback(hostname: string) {
  return ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(hostname.toLowerCase())
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'SWARMOPS_')
  const apiTarget = resolveAPIProxyTarget(process.env.SWARMOPS_API_URL ?? environment.SWARMOPS_API_URL)
  const proxy = { target: apiTarget, changeOrigin: true, secure: true }

  return {
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
      host: '127.0.0.1',
      port: 5284,
      proxy: {
        '/api': proxy,
        '/healthz': proxy,
        '/readyz': proxy,
      },
    },
  }
})
