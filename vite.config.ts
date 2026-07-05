import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Dev-only reverse proxy so the browser never talks to the model provider
 * directly. This sidesteps CORS (ollama.com does not send permissive CORS
 * headers) and keeps the API key out of cross-origin browser requests.
 *
 * The frontend calls `/__provider/<subpath>` and sets two headers:
 *   x-provider-base: the configured base URL (e.g. https://ollama.com)
 *   authorization:   Bearer <api key>   (passed straight through)
 *
 * We rebuild `${base}/<subpath>` and forward the request server-side.
 */
const PREFIX = '/__provider'

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function providerProxy(): Plugin {
  return {
    name: 'mocky-provider-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith(PREFIX)) return next()

        const base = (req.headers['x-provider-base'] as string | undefined)?.replace(/\/+$/, '')
        if (!base) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing x-provider-base header' }))
          return
        }

        const subpath = req.url.slice(PREFIX.length) // keeps leading slash + query
        const target = base + subpath

        try {
          const method = req.method || 'GET'
          const hasBody = method !== 'GET' && method !== 'HEAD'
          const body = hasBody ? await readBody(req) : undefined

          const headers: Record<string, string> = { accept: 'application/json' }
          if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'] as string
          if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string

          const upstream = await fetch(target, {
            method,
            headers,
            body: body && body.length ? body : undefined,
          })

          res.statusCode = upstream.status
          const ct = upstream.headers.get('content-type')
          if (ct) res.setHeader('content-type', ct)
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 502
          res.end(
            JSON.stringify({
              error: 'Proxy request failed',
              detail: err instanceof Error ? err.message : String(err),
              target,
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), providerProxy()],
  server: {
    // In dev, forward account/data API calls to the backend (npm run server).
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
