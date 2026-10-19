import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
          resolveTarget: (profile: string) => {
            textConfig.reload()
            return textConfig.target(profile)
          },
        })
      })
    },
  }
}

/**
 * Dev-only: the CORS header server/index.js puts on /fonts.
 *
 * A preview is a sandboxed frame with an opaque origin, and a font is always
 * fetched in CORS mode, so its request says `Origin: null` — which Vite's own
 * CORS default (localhost origins only) does not answer. Without this every
 * catalogue face (src/lib/fonts) loaded in production and fell back in silence
 * under `npm run dev`, which is where somebody would check that it works.
 */
function fontsCors(): Plugin {
  return {
    name: 'mocky-fonts-cors',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (req.url && req.url.startsWith('/fonts/')) res.setHeader('Access-Control-Allow-Origin', '*')
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), providerProxy(), fontsCors()],
  build: {
    rollupOptions: {
      // Two pages: the app, and the page the MCP runner's headless Chromium
      // opens (server/mcp/runner.js). The second shares the pipeline's modules
      // with the first — that is its whole point — so the bundler splits them.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        runner: path.resolve(__dirname, 'runner.html'),
      },
    },
  },
  server: {
    // In dev, forward account/data API calls and SSO callbacks to the backend
    // (npm run server). SSO needs same-origin so the session cookie set by the
    // backend applies to the SPA. The port follows the backend's own MOCKY_PORT,
    // or a backend moved off a busy 8787 left the SPA talking to whatever else
    // was listening there.
    proxy: {
      '/api': { target: `http://localhost:${process.env.MOCKY_PORT || 8787}`, changeOrigin: true },
      '/sso': { target: `http://localhost:${process.env.MOCKY_PORT || 8787}`, changeOrigin: true },
    },
  },
})