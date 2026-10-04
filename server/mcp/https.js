/**
 * When the MCP server may exist at all: a valid HTTPS origin.
 *
 * Mocky is installed by people other than us, mostly on a LAN over plain HTTP,
 * and Claude and ChatGPT only ever connect to an HTTPS address reachable from
 * the Internet. An MCP server switched on over HTTP would send OAuth codes and
 * bearer tokens in the clear for a client that cannot use it anyway. So the
 * admin section stays visible — it says what to fix — and is locked until:
 *
 *  1. `MOCKY_ORIGIN` is set and starts with `https://` — the OAuth issuer must
 *     be a stable URL, and the tokens are bound to `${origin}/mcp` (RFC 8707);
 *  2. the administrator's own request ARRIVED over HTTPS on that host — proof
 *     that TLS and the reverse proxy work, not merely that a variable is spelled
 *     right. Checked when they switch it on, not on every request.
 *
 * Reachability from the Internet is NOT checked, and the panel says so: a
 * self-test against one's own public URL fails behind most NATs and succeeds on
 * some setups that are not reachable from outside. The first connection from
 * Claude or ChatGPT is the only proof, and claiming one we did not make would be
 * the score that awards 4/4 to a screen nobody looked at (Q4).
 *
 * One escape, for development and tests only: `MOCKY_MCP_INSECURE_LOOPBACK=1`
 * accepts an `http://localhost` or `http://127.0.0.1` origin. A loopback address
 * cannot be reached by Claude.ai or ChatGPT, so it can only serve a client on
 * the same machine (Claude Code), which is exactly the case it exists for.
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Parse the configured origin, or null. */
function originUrl(origin) {
  try {
    return origin ? new URL(origin) : null
  } catch {
    return null
  }
}

/** Whether `origin` can carry the MCP server at all (condition 1). */
export function originAllowsMcp(origin, env = process.env) {
  const u = originUrl(origin)
  if (!u || u.pathname.replace(/\/+$/, '') !== '' || u.search || u.hash) return false
  if (u.protocol === 'https:') return true
  return u.protocol === 'http:' && LOOPBACK.has(u.hostname) && env.MOCKY_MCP_INSECURE_LOOPBACK === '1'
}

/** Whether THIS request reached us over TLS — the request itself, not the configuration. */
export function requestIsTls(req) {
  if (req?.secure) return true
  return (
    String(req?.headers?.['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase() === 'https'
  )
}

/**
 * The checklist the admin section shows, and the gate on switching it on.
 * Each item is a fact with its own answer; `ok` is whether the blocking ones hold.
 */
export function mcpReadiness(origin, req, env = process.env) {
  const u = originUrl(origin)
  const insecureLoopback = Boolean(u && u.protocol === 'http:' && originAllowsMcp(origin, env))
  const originOk = originAllowsMcp(origin, env)
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const hostOk = Boolean(u && host && host === u.host.toLowerCase())
  // On an insecure loopback origin there is no TLS to prove; the host is enough.
  const tlsOk = insecureLoopback ? true : requestIsTls(req)
  return {
    origin: u ? u.origin : null,
    mcpUrl: u ? `${u.origin}/mcp` : null,
    originHttps: originOk,
    requestHttps: tlsOk,
    hostMatches: hostOk,
    insecureLoopback,
    /** Never checked from the inside — see the comment at the top. */
    reachableFromInternet: 'unknown',
    ok: originOk && tlsOk && hostOk,
  }
}
