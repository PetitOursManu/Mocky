// Minimal self-hosted backend for Mocky: simple accounts + per-user data sync,
// a model-provider proxy (so production works without Vite), and static serving.
// Storage is plain JSON files under server/data — no database, no native deps.
import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProviderProxy } from './provider-proxy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// ---- .env loader (no dependency) ----
// Reads KEY=VALUE lines from <repo>/.env into process.env (does not override
// existing values). Lets SSO_* be configured locally without adding dotenv.
{
  const envFile = path.join(__dirname, '..', '.env')
  try {
    const raw = fs.readFileSync(envFile, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
      }
    }
  } catch {
    /* no .env — fine */
  }
}

// ---- SSO ("Sign in with Dashy") config ----
// Mocky acts as a client app; Dashy is the identity provider. Disabled unless
// both env vars are set. SSO_SHARED_SECRET is the HS256 secret shared with Dashy
// (it MUST match Dashy's SSO_SHARED_SECRET); SSO_DASHY_URL is Dashy's public
// origin, e.g. https://dashy.example.com. The callback URL Mocky registers in
// Dashy's SSO_ALLOWED_REDIRECTS is `${MOCKY_ORIGIN}/sso/dashy/callback`.
const SSO_SHARED_SECRET = process.env.SSO_SHARED_SECRET || ''
const SSO_DASHY_URL = (process.env.SSO_DASHY_URL || '').replace(/\/+$/, '')
const MOCKY_ORIGIN = (process.env.MOCKY_ORIGIN || '').replace(/\/+$/, '')
const ssoEnabled = Boolean(SSO_SHARED_SECRET && SSO_DASHY_URL)

// ---- tiny JSON file store ----
// Reads are plain; writes are atomic (write to a temp file then rename) so a
// crash mid-write never leaves a half-written/corrupt store.
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(file, obj) {
  const finalPath = path.join(DATA_DIR, file)
  const tmp = finalPath + '.' + crypto.randomBytes(6).toString('hex') + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, finalPath)
}

const loadUsers = () => readJson('users.json', [])
const saveUsers = (u) => writeJson('users.json', u)
const loadSessions = () => readJson('sessions.json', {})
const saveSessions = (s) => writeJson('sessions.json', s)
const loadConfig = () => readJson('config.json', { allowRegistration: true })
const saveConfig = (c) => writeJson('config.json', c)
const userDataFile = (id) => `data-${id}.json`

// ---- SSO token verification (HS256, with node:crypto — no deps) ----
// Dashy signs a 60-second JWT with SSO_SHARED_SECRET; we verify the signature,
// iss === 'dashy', aud === our own origin, and exp. We also track consumed jti
// values in a JSON file to enforce single use (a token can be redeemed once).
const SSO_JTI_FILE = 'sso-jti.json'
const loadConsumedJtis = () => readJson(SSO_JTI_FILE, {})
const saveConsumedJtis = (o) => writeJson(SSO_JTI_FILE, o)

function b64urlDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/**
 * Identity claims Dashy asserts in an SSO token (HS256, 60 s lifetime).
 * @typedef {Object} SsoClaims
 * @property {string} sub  - Stable Dashy user id.
 * @property {string} email
 * @property {string} [name] - Display name when available.
 * @property {'admin'|'subadmin'|'user'|'temp'} role
 * @property {string} iss  - Always "dashy".
 * @property {string} aud  - Mocky's origin.
 * @property {number} iat
 * @property {number} exp
 * @property {string} [jti] - Single-use id (we track consumed ones).
 */

/**
 * Verify a Dashy SSO token (HS256). Returns the {@link SsoClaims} on success,
 * throws on any failure (signature, iss, aud, exp, replay). `expectedAudience`
 * is the Mocky origin — the token's `aud` must match exactly.
 */
function verifySsoToken(token, expectedAudience) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed token')

  // Header check (defense in depth): refuse anything other than HS256.
  let header
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'))
  } catch {
    throw new Error('Malformed token header')
  }
  if (header.alg !== 'HS256') throw new Error('Unexpected token algorithm')

  // Signature check (constant-time).
  const signingInput = Buffer.from(parts[0] + '.' + parts[1])
  const sig = b64urlDecode(parts[2])
  const expected = crypto.createHmac('sha256', SSO_SHARED_SECRET).update(signingInput).digest()
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error('Invalid signature')
  }

  const claims = JSON.parse(b64urlDecode(parts[1]).toString('utf8'))
  if (claims.iss !== 'dashy') throw new Error('Wrong issuer')
  if (claims.aud !== expectedAudience) throw new Error('Wrong audience')
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp < now) throw new Error('Token expired')
  if (!claims.sub || !claims.email) throw new Error('Missing identity claims')
  return claims
}

/** Mark a jti as consumed; throws if it was already used (replay protection). */
function consumeJti(jti) {
  if (!jti) return
  const consumed = loadConsumedJtis()
  const now = Date.now()
  // Prune entries older than 10 minutes (tokens live 60s, plus margin).
  for (const k of Object.keys(consumed)) if (now - consumed[k] > 10 * 60 * 1000) delete consumed[k]
  if (consumed[jti]) {
    saveConsumedJtis(consumed)
    throw new Error('Token already used')
  }
  consumed[jti] = now
  saveConsumedJtis(consumed)
}

/** Find or create a Mocky user linked to a Dashy identity (by dashySub). */
function findOrCreateSsoUser(claims) {
  const users = loadUsers()
  let user = users.find((u) => u.dashySub === claims.sub)
  if (user) {
    // Keep email/role in sync with Dashy on each sign-in.
    if (user.email !== claims.email) user.email = claims.email
    // Only SSO-only accounts (no password) follow the Dashy display name, so a
    // user who also set a Mocky password keeps their chosen username.
    if (!user.salt && !user.hash && claims.name && user.username !== claims.name) {
      const candidates = users.filter((u) => u.id !== user.id)
      const name = claims.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 24)
      if (name && !candidates.some((u) => u.username === name)) user.username = name
    }
    // Dashy admins map to Mocky admins.
    const role = claims.role === 'admin' ? 'admin' : 'user'
    if (user.role !== role) user.role = role
    saveUsers(users)
    return user
  }
  // Derive a unique username: prefer name, else the local-part of the email.
  const base = (claims.name || String(claims.email).split('@')[0] || 'dashy-user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 24) || 'dashy-user'
  let username = base
  let n = 2
  while (users.some((u) => u.username === username)) username = `${base}${n++}`
  const role = claims.role === 'admin' ? 'admin' : 'user'
  user = {
    id: crypto.randomUUID(),
    username,
    email: claims.email,
    role,
    dashySub: claims.sub,
    // SSO users have no password — they can only sign in via Dashy.
    salt: null,
    hash: null,
    createdAt: Date.now(),
  }
  users.push(user)
  saveUsers(users)
  return user
}

// ---- password hashing (node crypto scrypt) ----
function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex')
}
function makeUser(username, password, role = 'user') {
  const salt = crypto.randomBytes(16).toString('hex')
  return {
    id: crypto.randomUUID(),
    username,
    email: null,
    role,
    dashySub: null,
    salt,
    hash: hashPw(password, salt),
    createdAt: Date.now(),
  }
}
const publicUser = (u) => ({ username: u.username, role: u.role || 'user' })
function verifyPw(user, password) {
  // SSO-only accounts have no password and cannot log in this way.
  if (!user.salt || !user.hash) return false
  const a = Buffer.from(hashPw(password, user.salt), 'hex')
  const b = Buffer.from(user.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---- app ----
const app = express()
app.use(cookieParser())

// ---- security headers (no CSP — the sandboxed previews need inline scripts) ----
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  next()
})

// ---- rate-limit on auth-sensitive routes (in-memory, per IP) ----
// Simple sliding-window counter: max `limit` hits per `windowMs` per IP. No
// dependency, no Redis — fine for a self-hosted single-instance deployment.
const authLimits = new Map() // ip → [{ t, count }]
function authRateLimit(limit = 8, windowMs = 60_000) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    let bucket = authLimits.get(ip)
    if (!bucket || now - bucket.t > windowMs) {
      bucket = { t: now, count: 0 }
      authLimits.set(ip, bucket)
    }
    bucket.count++
    // Opportunistic cleanup of stale buckets (keep the map small).
    if (authLimits.size > 1000) {
      for (const [k, v] of authLimits) if (now - v.t > windowMs) authLimits.delete(k)
    }
    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000))
      return res.status(429).json({ error: 'Too many attempts. Please try again in a minute.' })
    }
    next()
  }
}

// Model-provider proxy — forwards to `${x-provider-base}<subpath>` (raw body,
// so it must run before express.json()). The logic (incl. the SSRF guard) lives
// in ./provider-proxy.js, shared with the Vite dev middleware.
app.use('/__provider', (req, res) => handleProviderProxy(req, res))

app.use('/api', express.json({ limit: '25mb' }))

// ---- session helpers ----
function currentUser(req) {
  const token = req.cookies?.mocky_sess
  if (!token) return null
  const sess = loadSessions()[token]
  if (!sess) return null
  return loadUsers().find((u) => u.id === sess.u) || null
}
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const sessions = loadSessions()
  sessions[token] = { u: userId, t: Date.now() }
  saveSessions(sessions)
  res.cookie('mocky_sess', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 90,
  })
}

function requireAdmin(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if ((user.role || 'user') !== 'admin') return res.status(403).json({ error: 'Admin only.' })
  req.user = user
  next()
}

// Public config so the sign-in screen knows whether to offer registration
// and "Sign in with Dashy".
app.get('/api/config', (req, res) => {
  res.json({
    allowRegistration: loadConfig().allowRegistration !== false,
    setup: loadUsers().length === 0,
    sso: {
      enabled: ssoEnabled,
      dashyUrl: SSO_DASHY_URL || null,
    },
  })
})

// ---- auth routes (rate-limited against brute-force) ----
app.post('/api/register', authRateLimit(8), (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  const users = loadUsers()
  const isFirst = users.length === 0
  if (!isFirst && loadConfig().allowRegistration === false) {
    return res.status(403).json({ error: 'Public sign-ups are disabled. Ask an admin to create your account.' })
  }
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: 'Username already taken.' })
  // The very first account becomes the admin.
  const user = makeUser(username, password, isFirst ? 'admin' : 'user')
  users.push(user)
  saveUsers(users)
  setSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/login', authRateLimit(8), (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = loadUsers().find((u) => u.username === username)
  if (!user || !verifyPw(user, password)) return res.status(401).json({ error: 'Invalid username or password.' })
  setSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.mocky_sess
  if (token) {
    const sessions = loadSessions()
    delete sessions[token]
    saveSessions(sessions)
  }
  res.clearCookie('mocky_sess')
  res.json({ ok: true })
})

app.get('/api/me', (req, res) => {
  const user = currentUser(req)
  // 200 with null rather than 401 — the SPA polls this on every load to know
  // whether a session exists; a 401 there just adds noise to the console.
  res.json({ user: user ? publicUser(user) : null })
})

// ---- SSO callback ("Sign in with Dashy") ----
// Dashy redirects here with ?token=<jwt>&state=<opaque>. We verify the token
// server-side (the shared secret never leaves the server), find-or-create the
// Mocky account linked to the Dashy identity, set our session cookie, and
// redirect to the SPA. The `state` is echoed back as a query param so the
// client can check it against what it stored before the redirect.
app.get('/sso/dashy/callback', authRateLimit(15), (req, res) => {
  if (!ssoEnabled) return res.status(404).send('SSO is not enabled')
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  if (!token) return res.status(400).send('Missing token')

  // We must know our own public origin to validate the token's `aud` claim.
  // MOCKY_ORIGIN is authoritative when set. In dev (Vite proxy on :8787 → SPA
  // on :5173) the request's own host/origin is the *backend's*, not the SPA's,
  // so MOCKY_ORIGIN must be set to the SPA origin (e.g. http://localhost:5173).
  // We accept the request Origin header as a secondary fallback (the browser
  // sends it on the top-level redirect navigation).
  const expectedAudience =
    MOCKY_ORIGIN || req.get('origin') || `${req.protocol}://${req.get('host')}`

  let claims
  try {
    claims = verifySsoToken(token, expectedAudience)
    consumeJti(claims.jti)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Send the user back to the app with an error instead of a blank page.
    const target = MOCKY_ORIGIN || '/'
    const u = new URL(target.startsWith('http') ? target : `${expectedAudience}${target}`)
    u.searchParams.set('sso', 'error')
    u.searchParams.set('reason', msg)
    return res.redirect(302, u.toString())
  }

  const user = findOrCreateSsoUser(claims)
  setSession(res, user.id)

  // Redirect to the SPA. In production we serve it ourselves; in dev the Vite
  // proxy keeps everything same-origin, so '/' is correct in both cases.
  const dest = new URL(MOCKY_ORIGIN && MOCKY_ORIGIN.startsWith('http') ? MOCKY_ORIGIN : `${expectedAudience}/`)
  dest.pathname = '/'
  dest.searchParams.set('sso', 'ok')
  if (state) dest.searchParams.set('state', state)
  res.redirect(302, dest.toString())
})

// ---- admin routes ----
app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json({ allowRegistration: loadConfig().allowRegistration !== false })
})

app.put('/api/admin/config', requireAdmin, (req, res) => {
  const cfg = loadConfig()
  if (typeof req.body?.allowRegistration === 'boolean') cfg.allowRegistration = req.body.allowRegistration
  saveConfig(cfg)
  res.json({ allowRegistration: cfg.allowRegistration !== false })
})

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json({
    users: loadUsers().map((u) => ({ id: u.id, username: u.username, role: u.role || 'user', createdAt: u.createdAt })),
  })
})

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const role = req.body?.role === 'admin' ? 'admin' : 'user'
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  const users = loadUsers()
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: 'Username already taken.' })
  const user = makeUser(username, password, role)
  users.push(user)
  saveUsers(users)
  res.json({ user: { id: user.id, username: user.username, role: user.role } })
})

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' })
  const users = loadUsers()
  if (!users.some((u) => u.id === id)) return res.status(404).json({ error: 'User not found.' })
  saveUsers(users.filter((u) => u.id !== id))
  try {
    fs.rmSync(path.join(DATA_DIR, userDataFile(id)), { force: true })
  } catch {
    /* ignore */
  }
  const sessions = loadSessions()
  for (const t of Object.keys(sessions)) if (sessions[t].u === id) delete sessions[t]
  saveSessions(sessions)
  res.json({ ok: true })
})

// ---- per-user data (projects + design) ----
app.get('/api/data', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  res.json(readJson(userDataFile(user.id), { projects: null, design: null }))
})

app.put('/api/data', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const { projects, design } = req.body || {}
  writeJson(userDataFile(user.id), { projects: projects ?? null, design: design ?? null, updatedAt: Date.now() })
  res.json({ ok: true })
})

// ---- serve the built frontend (production) ----
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/__provider') || req.path.startsWith('/sso'))
      return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// MOCKY_PORT wins over the generic PORT so a dev harness that injects PORT (to
// tell Vite which port to use) can't accidentally push the backend onto the
// Vite port and collide with it. Production hosts that set PORT still work.
const PORT = process.env.MOCKY_PORT || process.env.PORT || 8787
app.listen(PORT, () => console.log(`Mocky backend on http://localhost:${PORT}`))
