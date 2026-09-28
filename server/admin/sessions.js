// The sessions of the instance, as the dashboard may show them.
//
// A session token is the credential itself — whoever holds the string is signed
// in — so it never leaves the server, not even to an administrator: the panel
// gets a HASH of it as the handle it revokes by. Showing tokens would turn the
// Sessions screen, and anything that ever captured it (a screenshot, a support
// ticket, a browser extension reading the page), into a way to become any user.
//
// What a session records about the device is a SUMMARY of its user agent
// ("Firefox 131 · Windows"), not the header: the full string adds nothing an
// administrator can act on and a good deal a fingerprint can.

import crypto from 'node:crypto'

/** The public handle of a session: not reversible, stable, short. */
export function sessionId(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 24)
}

/** "Browser major · OS", or null when the header says nothing recognisable. */
export function describeUserAgent(ua) {
  const s = String(ua || '')
  if (!s) return null
  const browsers = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/FxiOS\/(\d+)/, 'Firefox'],
    [/CriOS\/(\d+)/, 'Chrome'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]* .*Safari\//, 'Safari'],
    [/^curl\/(\d+)/, 'curl'],
    [/^node|undici/i, 'Node'],
  ]
  let browser = null
  for (const [re, name] of browsers) {
    const m = re.exec(s)
    if (m) {
      browser = m[1] ? `${name} ${m[1]}` : name
      break
    }
  }
  const os = /Windows NT/.test(s)
    ? 'Windows'
    : /Android/.test(s)
      ? 'Android'
      : /iPhone|iPod/.test(s)
        ? 'iOS'
        : /iPad/.test(s)
          ? 'iPadOS'
          : /Mac OS X|Macintosh/.test(s)
            ? 'macOS'
            : /CrOS/.test(s)
              ? 'ChromeOS'
              : /Linux/.test(s)
                ? 'Linux'
                : null
  if (!browser && !os) return null
  return [browser, os].filter(Boolean).join(' · ')
}

/**
 * The rows of the Sessions screen, newest activity first.
 *
 * @param {Record<string, {u:string, t:number, c?:number, ua?:string, ip?:string}>} sessions
 * @param {Array<{id:string, username:string, role?:string}>} users
 * @param {{ lastUse?: Map<string, number>, currentToken?: string|null }} opts
 *   `lastUse` is the in-memory "last request" per session id; the store's `t`
 *   is only rewritten once a day (so an active session does not rewrite the
 *   file on every request), which makes it a floor rather than an answer.
 */
export function listSessions(sessions, users, { lastUse = new Map(), currentToken = null } = {}) {
  const byId = new Map(users.map((u) => [u.id, u]))
  const current = currentToken ? sessionId(currentToken) : null
  const rows = []
  for (const [token, s] of Object.entries(sessions || {})) {
    if (!s || typeof s !== 'object') continue
    const user = byId.get(s.u)
    if (!user) continue
    const id = sessionId(token)
    rows.push({
      id,
      userId: user.id,
      username: user.username,
      role: user.role || 'user',
      // Absent on sessions opened before this was recorded: unknown, not "now".
      createdAt: typeof s.c === 'number' ? s.c : null,
      lastUsedAt: Math.max(lastUse.get(id) || 0, typeof s.t === 'number' ? s.t : 0) || null,
      device: typeof s.ua === 'string' ? s.ua : null,
      ip: typeof s.ip === 'string' ? s.ip : null,
      current: id === current,
    })
  }
  return rows.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
}

/** The token whose hash is `id`, or null. */
export function tokenForId(sessions, id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) return null
  for (const token of Object.keys(sessions || {})) if (sessionId(token) === id) return token
  return null
}
