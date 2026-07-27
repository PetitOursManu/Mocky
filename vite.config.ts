import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { handleProviderProxy } from './server/provider-proxy.js'
import { TextConfigStore } from './server/text/config.js'

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
  // In dev this middleware — not the Express backend — serves /__provider, so
  // it must read the SAME admin text-provider config file. It is re-read per
  // request so an admin change applies without restarting Vite.
  const textConfig = new TextConfigStore(path.resolve(__dirname, 'server/data'))
  return {
    name: 'mocky-provider-proxy',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/__provider')) return next()
        handleProviderProxy(req as any, res as any, fetch, {
          resolveTarget: () => {
            textConfig.reload()
            return textConfig.target()
          },
        })
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