// Shared provider-proxy logic used by both the Vite dev middleware and the
// Express production server. Keeps a single source of truth and applies the
// same SSRF guard in dev and in prod.
//
// It also acts as a DIALECT GATEWAY: Mocky always speaks Ollama's `/api/chat`
// shape, and this proxy translates it to/from OpenAI-compatible providers
// (OpenAI, OpenRouter, Groq, LM Studio…) when an admin has configured one. The
// generation, planner and Muse code paths are therefore vendor-agnostic.
import { buildUpstream, createSseTranslator, fromOpenAiModels, fromOpenAiResponse } from './text/dialect.js'

/**
 * Reject targets that would let a caller reach internal/private networks.
 * The proxy is intentionally open (no auth) so the anonymous localStorage mode
 * can call the model provider; the trade-off is that we must filter the
 * destination ourselves to prevent SSRF.
 *
 * Blocks: non-http(s) schemes, loopback, private ranges, link-local, and
 * cloud metadata endpoints (e.g. 169.254.169.254). Hostnames that resolve to
 * private IPs would still slip through a pure string check; for a hardened
 * deployment you'd also DNS-resolve and re-check, but this covers the common
 * cases without adding a DNS dependency.
 */
export function assertSafeTarget(target) {
  let url
  try {
    url = new URL(target)
  } catch {
    throw new Error('Invalid target URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) targets are allowed')
  }

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Localhost targets are not allowed')
  }

  // IPv4 literal?
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4) {
    const [_, a, b] = ipv4.map(Number)
    const isPrivate =
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // link-local + cloud metadata
      (a === 127) // loopback
    if (isPrivate) throw new Error('Private/internal IP targets are not allowed')
  }

  // IPv6 loopback / link-local / unique-local
  if (host === '::1' || host === '[::1]' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) {
    throw new Error('Private/internal IPv6 targets are not allowed')
  }
}

/**
 * Read the raw request body (no parsing). Used for the provider proxy because
 * we forward the body verbatim.
 */
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Forward a provider request to `${base}${subpath}`, passing through the
 * Authorization and Content-Type headers. `base` comes from the
 * `x-provider-base` request header set by the frontend.
 *
 * `fetchImpl` is injected so the same code works in Vite (global fetch) and in
 * Express (Node global fetch).
 */
export async function handleProviderProxy(req, res, fetchImpl = fetch, opts = {}) {
  // An admin-configured provider (Admin → Modèle de texte) wins over whatever
  // the browser sends. When none is set, we use the browser's own Settings —
  // preserving the original "key never leaves the browser" mode and the
  // frontend-only deployment.
  let configured = null
  try {
    configured = opts.resolveTarget ? opts.resolveTarget() : null
  } catch {
    configured = null
  }

  const base = configured
    ? String(configured.baseUrl || '').replace(/\/+$/, '')
    : String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
  if (!base) {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing x-provider-base header' }))
    return
  }

  // Subpath resolution must work in BOTH hosts:
  //  • Vite dev middleware — no mount path, so req.url = "/__provider/api/chat"
  //  • Express `app.use('/__provider', …)` — the mount path is STRIPPED, so
  //    req.url = "/api/chat" while req.originalUrl keeps the full path.
  // Slicing req.url blindly produced an empty subpath under Express, which
  // silently pointed every request at the provider's root.
  const prefix = '/__provider'
  const fullUrl = req.originalUrl || req.url || ''
  const subpath = fullUrl.startsWith(prefix) ? fullUrl.slice(prefix.length) : req.url || ''
  const target = base + subpath

  // The SSRF guard protects us from BROWSER-supplied URLs. An admin-configured
  // endpoint is trusted on purpose: pointing at a local LLM (Ollama, LM Studio,
  // vLLM on 127.0.0.1) is a supported setup, and only an admin can set it.
  if (!configured) {
    try {
      assertSafeTarget(target)
    } catch (err) {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: err.message, target }))
      return
    }
  }

  try {
    const method = req.method || 'GET'
    const hasBody = method !== 'GET' && method !== 'HEAD'
    let body = hasBody ? await readRawBody(req) : undefined

    // With an admin provider, the model must come from the server config —
    // the browser's Settings model belongs to a different vendor.
    if (configured && body && body.length) {
      try {
        const parsed = JSON.parse(body.toString())
        if (parsed && typeof parsed === 'object' && parsed.model !== undefined) {
          parsed.model = configured.model
          body = Buffer.from(JSON.stringify(parsed))
        }
      } catch {
        /* not JSON — forward as-is */
      }
    }

    const plan = configured
      ? buildUpstream(configured, subpath, body)
      : {
          url: target,
          headers: {
            accept: 'application/json',
            ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
            ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
          },
          body,
          translate: false,
          isModels: false,
        }

    const upstream = await fetchImpl(plan.url, {
      method: plan.isModels ? 'GET' : method,
      headers: plan.headers,
      body: plan.body && plan.body.length ? plan.body : undefined,
    })

    res.statusCode = upstream.status

    // --- OpenAI-compatible: translate the answer back to the Ollama dialect ---
    if (plan.translate && upstream.ok) {
      const wantsStream = (() => {
        if (plan.isModels) return false
        try {
          return JSON.parse(plan.body.toString()).stream === true
        } catch {
          return false
        }
      })()

      if (!wantsStream) {
        const json = await upstream.json().catch(() => ({}))
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(plan.isModels ? fromOpenAiModels(json) : fromOpenAiResponse(json)))
        return
      }

      res.setHeader('content-type', 'application/x-ndjson')
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      const translate = createSseTranslator()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const ndjson = translate(decoder.decode(value, { stream: true }))
          if (ndjson) res.write(ndjson)
        }
      } finally {
        reader.releaseLock?.()
      }
      res.write(JSON.stringify({ done: true }) + '\n')
      res.end()
      return
    }

    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)

    // Determine if this is a streaming response (NDJSON) or a regular JSON
    // response. For streaming we pipe chunks through immediately; for regular
    // responses we buffer and send in one shot so the client can parse JSON.
    // We check two things: the request body (did the client ask for stream:true?)
    // and the response content-type (Ollama sends x-ndline for streams).
    let requestedStream = false
    if (body && body.length) {
      try { requestedStream = JSON.parse(body.toString()).stream === true } catch {}
    }
    const isStreaming = requestedStream || (ct && ct.includes('x-ndline'))

    if (isStreaming && upstream.body && typeof upstream.body.getReader === 'function') {
      const reader = upstream.body.getReader()
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock?.()
      }
      res.end()
    } else {
      // Regular JSON response: buffer and send in one piece.
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.end(buf)
    }
  } catch (err) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'Proxy request failed',
        detail: err instanceof Error ? err.message : String(err),
        target,
      }),
    )
  }
}