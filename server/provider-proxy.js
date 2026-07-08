// Shared provider-proxy logic used by both the Vite dev middleware and the
// Express production server. Keeps a single source of truth and applies the
// same SSRF guard in dev and in prod.

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
export async function handleProviderProxy(req, res, fetchImpl = fetch) {
  const base = String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
  if (!base) {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing x-provider-base header' }))
    return
  }

  const prefix = '/__provider'
  const subpath = req.url ? req.url.slice(prefix.length) : ''
  const target = base + subpath

  try {
    assertSafeTarget(target)
  } catch (err) {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err.message, target }))
    return
  }

  try {
    const method = req.method || 'GET'
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody ? await readRawBody(req) : undefined

    const headers = { accept: 'application/json' }
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization']
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']

    const upstream = await fetchImpl(target, {
      method,
      headers,
      body: body && body.length ? body : undefined,
    })

    res.statusCode = upstream.status
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)

    // Stream the response body through instead of buffering it all. This is
    // essential for streaming chat responses (stream: true) where the model
    // sends NDJSON line-by-line. Without piping, the entire response would be
    // buffered and the client would see nothing until the model finishes.
    if (upstream.body && typeof upstream.body.pipeTo === 'function') {
      // Web ReadableStream (Node fetch) — pipe to the response
      // Disable Nagle's algorithm for lower latency on small chunks
      if (typeof res.socket?.setNoDelay === 'function') res.socket.setNoDelay(true)
      // Flush headers immediately so the client starts receiving data
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      upstream.body.pipeTo(res)
        .catch(() => { try { res.end() } catch {} })
    } else if (upstream.body && typeof upstream.body[Symbol.asyncIterator] === 'function') {
      // Async iterable (Node Readable) — pump chunks through
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      for await (const chunk of upstream.body) {
        res.write(chunk)
      }
      res.end()
    } else {
      // Fallback: buffer the whole thing
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