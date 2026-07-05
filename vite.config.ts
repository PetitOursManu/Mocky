import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleProviderProxy } from './server/provider-proxy.js'

/**
 * Dev-only reverse proxy so the browser never talks to the model provider
 * directly. This sidesteps CORS (ollama.com does not send permissive CORS
 * headers) and keeps the API key out of cross-origin browser requests.
 *
 * The proxy logic (including the SSRF guard) lives in server/provider-proxy.js,
 * shared with the Express production server so both environments behave
 * identically.
 */
function providerProxy(): Plugin {
  return {
    name: 'mocky-provider-proxy',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/__provider')) return next()
        handleProviderProxy(req as any, res as any)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), providerProxy()],
  server: {
    // In dev, forward account/data API calls and SSO callbacks to the backend
    // (npm run server). SSO needs same-origin so the session cookie set by the
    // backend applies to the SPA.
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/sso': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})