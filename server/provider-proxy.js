// Shared provider-proxy logic used by both the Vite dev middleware and the
// Express production server. Keeps a single source of truth and applies the
// same SSRF guard in dev and in prod.
//
// It also acts as a DIALECT GATEWAY: Mocky always speaks Ollama's `/api/chat`
// shape, and this proxy translates it to/from OpenAI-compatible providers
// (OpenAI, OpenRouter, Groq, LM Studio…) when an admin has configured one. The
// generation, planner and Muse code paths are therefore vendor-agnostic.
import { buildUpstream, createSseTranslator, fromOpenAiModels, fromOpenAiResponse, KIND_OPENAI } from './text/dialect.js'

import dns from 'node:dns/promises'

/** True for an IPv4 address that must never be reachable through the proxy. */
function isBlockedIpv4(a, b) {
  return (
    a === 0 || // 0.0.0.0/8 — "this network"; 0.0.0.0 itself routes to localhost
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 carrier-grade NAT
    (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    a >= 224 // multicast + reserved
  )
}

/** True for an IPv6 address that must never be reachable through the proxy. */
function isBlockedIpv6(host) {
  const h = host.toLowerCase()
  if (h === '::' || h === '::1') return true
  // Unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd]/.test(h) || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb'))
    return true
  // IPv4-mapped/compatible forms — ::ffff:127.0.0.1 and its hex twin
  // ::ffff:7f00:1 both reach the loopback, and both used to sail straight
  // through: URL parsing leaves the brackets on, so no string test matched.
  const mapped = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (mapped) return isBlockedIpv4(Number(mapped[1]), Number(mapped[2]))
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h)
  if (mappedHex) {
    const n = (parseInt(mappedHex[1], 16) << 16) | parseInt(mappedHex[2], 16)
    return isBlockedIpv4((n >>> 24) & 0xff, (n >>> 16) & 0xff)
  }
  return false
}

/** Reject an IP literal that points anywhere internal. Accepts bare addresses. */
export function assertSafeIp(address) {
  const host = String(address).toLowerCase().replace(/^\[|\]$/g, '')
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4) {
    if (isBlockedIpv4(Number(ipv4[1]), Number(ipv4[2])))
      throw new Error('Private/internal IP targets are not allowed')
    return
  }
  if (host.includes(':') && isBlockedIpv6(host)) {
    throw new Error('Private/internal IPv6 targets are not allowed')
  }
}

/**
 * Reject targets that would let a caller reach internal/private networks.
 * The proxy is intentionally open (no auth) so the anonymous localStorage mode
 * can call the model provider; the trade-off is that we must filter the
 * destination ourselves to prevent SSRF.
 *
 * This is the cheap, synchronous half: scheme and address-literal checks. It
 * cannot see through a hostname that resolves to a private address — use
 * {@link assertSafeTargetResolved} on any path that actually makes the request.
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

  // `new URL()` keeps the brackets around an IPv6 literal, so they are stripped
  // inside assertSafeIp rather than being compared against bracketed strings.
  assertSafeIp(host)
  return url
}

/**
 * The full guard: literal checks, then DNS resolution with every returned
 * address re-checked. Without this step a hostname the caller controls
 * (`evil.test` → A 127.0.0.1) walks past the string tests untouched.
 */
export async function assertSafeTargetResolved(target) {
  const url = assertSafeTarget(target)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  // Already an IP literal — assertSafeTarget checked it, nothing to resolve.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return url

  let addresses
  try {
    addresses = await dns.lookup(host, { all: true })
  } catch {
    // Unresolvable: let the request proceed and fail naturally on connect,
    // rather than turning a DNS hiccup into a confusing security error.
    return url
  }
  for (const { address } of addresses) assertSafeIp(address)
  return url
}

/**
 * Which admin profile a request belongs to. Muse tags its own calls with
 * `x-mocky-profile: inspiration` so an admin can point art direction at a
 * different (e.g. vision-capable, or cheaper) model than screen generation.
 * Anything else — including no header at all — is normal generation.
 */
export function profileFromRequest(req) {
  const raw = req?.headers?.['x-mocky-profile']
  return String(Array.isArray(raw) ? raw[0] : raw || '').toLowerCase() === 'inspiration'
    ? 'inspiration'
    : 'generation'
}

/** Largest body the proxy will buffer. Matches express.json()'s limit on /api. */
export const MAX_PROXY_BODY = 25 * 1024 * 1024

/**
 * Read the raw request body (no parsing). Used for the provider proxy because
 * we forward the body verbatim.
 *
 * Bounded on purpose. Unbounded, this accumulated whatever the client sent and
 * then called Buffer.concat inside the 'end' listener — so a body past
 * buffer.constants.MAX_LENGTH threw outside any promise chain, which with no
 * uncaughtException handler anywhere took the whole server down.
 */
export function readRawBody(req, limit = MAX_PROXY_BODY) {
  return new Promise((resolve, reject) => {
    // Announced-too-large: refuse before reading a single byte, so a 200 MB
    // upload doesn't have to finish before the sender learns it was rejected.
    const announced = Number(req.headers?.['content-length'])
    if (Number.isFinite(announced) && announced > limit) {
      const err = new Error('Request body too large')
      err.statusCode = 413
      reject(err)
      return
    }
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        const err = new Error('Request body too large')
        err.statusCode = 413
        // Pause rather than destroy. `req.destroy(err)` killed the socket
        // before the route could answer, so the client saw ECONNRESET —
        // "network error" — instead of the 413 every caller already writes.
        req.pause()
        req.unpipe?.()
        reject(err)
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(Buffer.concat(chunks))
      } catch (err) {
        reject(err)
      }
    })
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
/**
 * The only upstream endpoints Mocky ever calls. Everything else is refused.
 *
 * Without this the proxy forwarded any path with any method, so
 * `DELETE /__provider/api/delete` with `{"name":"llama3"}` reached the
 * configured Ollama and removed a model: the body rewrite only ever replaces
 * `model`, so `name` went through untouched.
 *
 * It lives here rather than in the Express mount because in development the
 * Vite middleware — not Express — serves /__provider, and the two hosts are
 * supposed to behave identically.
 */
export const ALLOWED_SUBPATHS = new Set(['/api/chat', '/api/tags'])

export async function handleProviderProxy(req, res, fetchImpl = fetch, opts = {}) {
  // An admin-configured provider (Admin → Modèle de texte) wins over whatever
  // the browser sends. When none is set, we use the browser's own Settings —
  // preserving the original "key never leaves the browser" mode and the
  // frontend-only deployment.
  let configured = null
  try {
    configured = opts.resolveTarget ? opts.resolveTarget(profileFromRequest(req)) : null
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

  if (!ALLOWED_SUBPATHS.has(subpath.split('?')[0])) {
    res.statusCode = 404
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        error: `Endpoint not proxied: ${subpath.split('?')[0]}`,
        detail: `Mocky only forwards ${[...ALLOWED_SUBPATHS].join(' and ')}.`,
      }),
    )
    return
  }

  const target = base + subpath
  /** Aborts the upstream request when the client disconnects. Set below. */
  let abort = null

  // The SSRF guard protects us from BROWSER-supplied URLs. An admin-configured
  // endpoint is trusted on purpose: pointing at a local LLM (Ollama, LM Studio,
  // vLLM on 127.0.0.1) is a supported setup, and only an admin can set it.
  if (!configured) {
    try {
      await assertSafeTargetResolved(target)
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
    let body
    try {
      body = hasBody ? await readRawBody(req) : undefined
    } catch (err) {
      res.statusCode = err?.statusCode === 413 ? 413 : 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not read request body' }))
      return
    }

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

    // A browser-supplied endpoint that speaks OpenAI goes through the SAME
    // translator as an admin-configured one. It could not before: the browser
    // never said which dialect its endpoint spoke, so the only safe thing was to
    // forward verbatim — which is why "bring your own key" was stuck on Ollama
    // while the admin path reached anything. `x-provider-kind` is that missing
    // fact, and it is a hint about FORMAT only: the target host still comes from
    // x-provider-base and is still SSRF-checked above, so this widens no trust.
    const browserKind = String(req.headers['x-provider-kind'] || '').toLowerCase()
    const plan = configured
      ? buildUpstream(configured, subpath, body)
      : browserKind === KIND_OPENAI
        ? buildUpstream(
            {
              kind: KIND_OPENAI,
              baseUrl: base,
              // Forward the caller's own credential untouched. `authHeader`
              // rebuilds it from apiKey, so hand it the bare token.
              apiKey: String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, ''),
            },
            subpath,
            body,
          )
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

    // Hang up on the provider when the browser hangs up on us. Without this the
    // proxy kept draining the stream to the last token after the user pressed
    // "stop" or closed the tab — on an admin-configured provider that is the
    // host's own credits being spent on an answer nobody will ever see.
    abort = new AbortController()
    req.on('close', () => {
      if (!res.writableEnded) abort.abort()
    })

    const upstream = await fetchImpl(plan.url, {
      method: plan.isModels ? 'GET' : method,
      headers: plan.headers,
      body: plan.body && plan.body.length ? plan.body : undefined,
      // undici follows redirects by default, which walked straight around the
      // SSRF guard: the target passed the check, then answered 302 to
      // http://169.254.169.254/… and we happily returned the body. Redirects are
      // surfaced instead of followed.
      redirect: 'manual',
      signal: abort.signal,
    })

    if (!configured && upstream.status >= 300 && upstream.status < 400) {
      res.statusCode = 502
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'Provider answered with a redirect, which is not followed',
          detail: `The endpoint redirected to ${upstream.headers.get('location') || 'an unspecified location'}. Point x-provider-base at the final URL.`,
        }),
      )
      return
    }

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
          if (res.destroyed) break
          const { done, value } = await reader.read()
          if (done) break
          const ndjson = translate(decoder.decode(value, { stream: true }))
          if (ndjson) res.write(ndjson)
        }
      } finally {
        reader.releaseLock?.()
      }
      if (res.destroyed) return
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
          if (res.destroyed) break
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock?.()
      }
      if (!res.destroyed) res.end()
    } else {
      // Regular JSON response: buffer and send in one piece.
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.end(buf)
    }
  } catch (err) {
    // Once a stream has started, the headers are already gone. Writing one here
    // threw ERR_HTTP_HEADERS_SENT *inside the catch*, so the rejection escaped
    // the promise entirely — and Express 4 never observes a returned promise,
    // which took the whole process down every time a provider cut a stream
    // mid-answer. Past that point the only honest move is to hang up.
    if (res.headersSent || res.destroyed) {
      try {
        res.end()
      } catch {
        /* socket already gone */
      }
      return
    }
    // A client that went away is not a provider failure — say nothing.
    if (abort?.signal.aborted) {
      try {
        res.end()
      } catch {
        /* socket already gone */
      }
      return
    }
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