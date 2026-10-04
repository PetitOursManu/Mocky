/**
 * Who is connected through MCP, and with which tokens — `mcp-oauth.json`.
 *
 * Three kinds of record, and only the first two are on disk:
 *
 *  - CLIENTS, registered by the assistants themselves (RFC 7591). Public data:
 *    a name and where to send a person back. Capped, and an unused one is
 *    forgotten after a week — the registration endpoint is open to anyone, and
 *    a store that grows on every anonymous POST is a disk-filling endpoint.
 *  - CONNECTIONS — one per "person X let assistant Y in" — each holding its
 *    tokens BY HASH (SHA-256), like the dashboard holds sessions (D2): a copy of
 *    this file does not let anyone call /mcp. Revoking a connection deletes its
 *    tokens; that is the whole of "disconnect".
 *  - In memory only: consent requests waiting for a click (10 min) and
 *    authorization codes waiting for their exchange (2 min). A restart loses
 *    them, and the assistant simply asks again.
 *
 * Refresh tokens ROTATE: each use returns a new one and retires the old. An old
 * one presented again means two parties hold the same token — one of them stole
 * it — and the connection is revoked as a whole (OAuth 2.1 §4.3.1). Retired
 * hashes are kept until they would have expired, which is what makes that
 * detectable.
 *
 * Does not travel with a migration (server/migration/manifest.js), for the
 * reason sessions do not: a token is a credential for one server.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const MAX_CLIENTS = 1000
export const UNUSED_CLIENT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const PENDING_TTL_MS = 10 * 60 * 1000
export const MAX_PENDING = 200
export const CODE_TTL_MS = 2 * 60 * 1000
/** How often a connection's "last used" may reach the disk — every call would be a write per call. */
const TOUCH_PERSIST_MS = 60 * 1000

export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')
const randomToken = () => crypto.randomBytes(32).toString('base64url')
const randomId = () => crypto.randomBytes(16).toString('hex')

export function createOAuthStore(dataDir, { now = () => Date.now() } = {}) {
  const file = path.join(dataDir, 'mcp-oauth.json')
  let state = load()
  const pending = new Map() // id → request
  const codes = new Map() // hash(code) → grant
  let saveTimer = null

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return {
        clients: raw.clients && typeof raw.clients === 'object' ? raw.clients : {},
        connections: raw.connections && typeof raw.connections === 'object' ? raw.connections : {},
      }
    } catch {
      return { clients: {}, connections: {} }
    }
  }

  function prune() {
    const t = now()
    for (const [id, c] of Object.entries(state.connections)) {
      for (const [h, tok] of Object.entries(c.tokens || {})) if (tok.expiresAt <= t) delete c.tokens[h]
      // A connection whose last refresh token has expired can never be used again.
      if (!Object.values(c.tokens || {}).some((tok) => tok.kind === 'refresh' && !tok.retired)) delete state.connections[id]
    }
    const inUse = new Set(Object.values(state.connections).map((c) => c.clientId))
    for (const [id, cl] of Object.entries(state.clients)) {
      if (!inUse.has(id) && t - (cl.client_id_issued_at || 0) * 1000 > UNUSED_CLIENT_TTL_MS) delete state.clients[id]
    }
    for (const [id, p] of pending) if (t - p.createdAt > PENDING_TTL_MS) pending.delete(id)
    for (const [h, g] of codes) if (g.expiresAt <= t) codes.delete(h)
  }

  function save() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    prune()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    // 0600: hashes are not tokens, but the file still says who connected what.
    fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function saveSoon() {
    if (!saveTimer) {
      saveTimer = setTimeout(save, TOUCH_PERSIST_MS)
      saveTimer.unref?.()
    }
  }

  // ---- clients ---------------------------------------------------------------

  function getClient(id) {
    return typeof id === 'string' ? state.clients[id] : undefined
  }

  /** Register a client; throws a plain Error the caller turns into an OAuth one. */
  function registerClient(info) {
    prune()
    if (Object.keys(state.clients).length >= MAX_CLIENTS) throw new Error('Too many registered clients.')
    const client = {
      ...info,
      client_id: typeof info.client_id === 'string' && info.client_id ? info.client_id : randomId(),
      client_id_issued_at: Math.floor(now() / 1000),
    }
    state.clients[client.client_id] = client
    save()
    return client
  }

  // ---- consent requests (memory) --------------------------------------------

  function addPending(req) {
    prune()
    if (pending.size >= MAX_PENDING) throw new Error('Too many authorization requests in flight.')
    const id = randomId()
    pending.set(id, { ...req, id, createdAt: now() })
    return id
  }

  function getPending(id) {
    prune()
    return typeof id === 'string' ? pending.get(id) : undefined
  }

  function takePending(id) {
    const p = getPending(id)
    if (p) pending.delete(id)
    return p
  }

  // ---- authorization codes (memory) -----------------------------------------

  /** A single-use code for a consent just given. Returns the code itself; only its hash is kept. */
  function issueCode(grant) {
    const code = randomToken()
    codes.set(hashToken(code), { ...grant, expiresAt: now() + CODE_TTL_MS })
    return code
  }

  function peekCode(code) {
    prune()
    return codes.get(hashToken(code))
  }

  function takeCode(code) {
    const h = hashToken(code)
    const g = peekCode(code)
    if (g) codes.delete(h)
    return g
  }

  // ---- connections and tokens -------------------------------------------------

  function mint(conn, kind, ttlMs) {
    const token = randomToken()
    conn.tokens[hashToken(token)] = { kind, expiresAt: now() + ttlMs }
    return token
  }

  /** A new connection for a consent, with its first pair of tokens. */
  function createConnection({ userId, clientId, clientName, scopes, accessMs, refreshMs }) {
    const id = randomId()
    const conn = { id, userId, clientId, clientName, scopes: scopes || [], createdAt: now(), lastUsedAt: now(), tokens: {} }
    state.connections[id] = conn
    const access = mint(conn, 'access', accessMs)
    const refresh = mint(conn, 'refresh', refreshMs)
    save()
    return { connection: conn, access, refresh }
  }

  /** The connection and record behind a token, or null. Expired tokens are not found. */
  function findToken(token) {
    const h = hashToken(token)
    const t = now()
    for (const conn of Object.values(state.connections)) {
      const rec = conn.tokens?.[h]
      if (rec && rec.expiresAt > t) return { conn, rec, hash: h }
    }
    return null
  }

  /**
   * Trade a refresh token for a new pair. Returns null for an unknown token,
   * and REVOKES the connection when the token was already retired (reuse).
   */
  function rotate(refreshToken, clientId, { accessMs, refreshMs }) {
    const found = findToken(refreshToken)
    if (!found || found.rec.kind !== 'refresh' || found.conn.clientId !== clientId) return { ok: false }
    if (found.rec.retired) {
      revoke(found.conn.id)
      return { ok: false, reused: true, connection: found.conn }
    }
    found.rec.retired = true
    // The retired one keeps its own expiry: that is how long a replay stays detectable.
    for (const [h, tok] of Object.entries(found.conn.tokens)) if (tok.kind === 'access') delete found.conn.tokens[h]
    const access = mint(found.conn, 'access', accessMs)
    const refresh = mint(found.conn, 'refresh', refreshMs)
    found.conn.lastUsedAt = now()
    save()
    return { ok: true, connection: found.conn, access, refresh }
  }

  /** Mark a connection used. Persisted at most once a minute. */
  function touch(connectionId) {
    const c = state.connections[connectionId]
    if (!c) return
    c.lastUsedAt = now()
    saveSoon()
  }

  function revoke(connectionId) {
    if (!state.connections[connectionId]) return false
    delete state.connections[connectionId]
    save()
    return true
  }

  /** Revoke one token (RFC 7009). A refresh token takes its connection with it. */
  function revokeToken(token, clientId) {
    const found = findToken(token)
    if (!found || found.conn.clientId !== clientId) return
    if (found.rec.kind === 'refresh') revoke(found.conn.id)
    else {
      delete found.conn.tokens[found.hash]
      save()
    }
  }

  /** Every connection of one user — or of everyone. Never a token, never a hash. */
  function listConnections(userId) {
    prune()
    return Object.values(state.connections)
      .filter((c) => !userId || c.userId === userId)
      .map(({ id, userId: u, clientId, clientName, scopes, createdAt, lastUsedAt }) => ({
        id,
        userId: u,
        clientId,
        clientName,
        scopes,
        createdAt,
        lastUsedAt,
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  }

  function getConnection(id) {
    return state.connections[id]
  }

  /** Everything a user granted, when they lose the right or their account. */
  function revokeUser(userId) {
    let n = 0
    for (const c of Object.values(state.connections)) if (c.userId === userId) (delete state.connections[c.id], n++)
    if (n) save()
    return n
  }

  /** For shutdown: write what `touch` was holding back. */
  function flush() {
    if (saveTimer) save()
  }

  return {
    getClient,
    registerClient,
    addPending,
    getPending,
    takePending,
    issueCode,
    peekCode,
    takeCode,
    createConnection,
    findToken,
    rotate,
    touch,
    revoke,
    revokeToken,
    revokeUser,
    listConnections,
    getConnection,
    flush,
  }
}
