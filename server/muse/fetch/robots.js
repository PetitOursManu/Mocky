// Lightweight robots.txt check (no dependency). Honors the standard groups:
// a `User-agent:` line (or several) starts a group; the following
// Allow/Disallow lines apply to it. We pick the most specific group matching our
// UA, else the `*` group, and decide with longest-prefix match (Allow wins ties).
//
// Fail-open: a missing/unreachable/invalid robots.txt means "allowed" — we never
// block a fetch because robots.txt itself couldn't be read (M7 still caps
// fetches and caches results to keep load on source sites low).
import { assertSafeTargetResolved } from '../../provider-proxy.js'

/**
 * Parse robots.txt text into per-user-agent rule groups.
 * @returns {Map<string, {allow:string[], disallow:string[]}>} keyed by lowercased UA token
 */
export function parseRobots(text) {
  const groups = new Map()
  let currentAgents = []
  let sawRuleSinceAgent = false

  const ensure = (ua) => {
    if (!groups.has(ua)) groups.set(ua, { allow: [], disallow: [] })
    return groups.get(ua)
  }

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent') {
      // Consecutive user-agent lines share the next block of rules.
      if (sawRuleSinceAgent) {
        currentAgents = []
        sawRuleSinceAgent = false
      }
      currentAgents.push(value.toLowerCase())
      ensure(value.toLowerCase())
    } else if (field === 'allow' || field === 'disallow') {
      sawRuleSinceAgent = true
      const targets = currentAgents.length ? currentAgents : ['*']
      for (const ua of targets) {
        const g = ensure(ua)
        // An empty Disallow means "allow everything" — represent by no rule.
        if (value === '') continue
        if (field === 'allow') g.allow.push(value)
        else g.disallow.push(value)
      }
    }
  }
  return groups
}

/** Select the rule group for a UA: most specific token match, else `*`, else null. */
export function groupForAgent(groups, userAgent) {
  const ua = String(userAgent || '').toLowerCase()
  let best = null
  let bestLen = -1
  for (const key of groups.keys()) {
    if (key === '*') continue
    // robots matches when the UA product token appears in our UA string.
    if (ua.includes(key) && key.length > bestLen) {
      best = key
      bestLen = key.length
    }
  }
  if (best) return groups.get(best)
  return groups.get('*') || null
}

/** Decide a path against a group's allow/disallow with longest-prefix (Allow wins ties). */
export function isPathAllowed(group, pathname) {
  if (!group) return true
  const p = pathname || '/'
  let decision = true
  let matchLen = -1
  for (const rule of group.disallow) {
    if (rule && p.startsWith(rule) && rule.length > matchLen) {
      matchLen = rule.length
      decision = false
    }
  }
  for (const rule of group.allow) {
    if (rule && p.startsWith(rule) && rule.length >= matchLen) {
      matchLen = rule.length
      decision = true
    }
  }
  return decision
}

async function fetchWithTimeout(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // Redirects are followed by hand, re-validating every hop. `redirect:
    // 'follow'` walked straight around the SSRF guard: the origin passed the
    // check, then answered 302 to http://169.254.169.254/ and the process
    // fetched it. Following manually keeps robots.txt compliance intact for the
    // sites that legitimately redirect it (http→https, apex→www).
    let current = url
    for (let hop = 0; hop < 4; hop++) {
      await assertSafeTargetResolved(current)
      const res = await fetchImpl(current, { signal: ctrl.signal, redirect: 'manual' })
      if (!res || res.status < 300 || res.status >= 400) return res
      const location = res.headers?.get?.('location')
      if (!location) return res
      current = new URL(location, current).toString()
    }
    return null // redirect loop — fail open, same as any other error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Return true if `url`'s path is allowed for `userAgent` per the origin's
 * robots.txt. Fail-open on any error.
 */
export async function robotsAllows(url, userAgent, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const timeoutMs = opts.timeoutMs ?? 5000
  let u
  try {
    u = new URL(url)
  } catch {
    return true
  }
  try {
    const res = await fetchWithTimeout(`${u.origin}/robots.txt`, fetchImpl, timeoutMs)
    if (!res || !res.ok) return true // no robots.txt (404) or error → allowed
    const text = await res.text()
    const groups = parseRobots(text)
    const group = groupForAgent(groups, userAgent)
    return isPathAllowed(group, u.pathname || '/')
  } catch {
    return true
  }
}
