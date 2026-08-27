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

function resolveWebPort(value?: string) {
  const port = Number(value?.trim() || '5284')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SWARMOPS_WEB_PORT must be a port between 1 and 65535')
  }
  return port
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'SWARMOPS_')
  const apiTarget = resolveAPIProxyTarget(process.env.SWARMOPS_API_URL ?? environment.SWARMOPS_API_URL)
  const webPort = resolveWebPort(process.env.SWARMOPS_WEB_PORT ?? environment.SWARMOPS_WEB_PORT)
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
      port: webPort,
      proxy: {
        '/api': proxy,
        '/healthz': proxy,
        '/readyz': proxy,
      },
    },
  }
})
