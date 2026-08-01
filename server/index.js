// Minimal self-hosted backend for Mocky: simple accounts + per-user data sync,
// a model-provider proxy (so production works without Vite), and static serving.
// Storage is plain JSON files under server/data — no database, no native deps.
import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProviderProxy, profileFromRequest, assertSafeTargetResolved } from './provider-proxy.js'
import { createMuse } from './muse/index.js'
import { createMuseRouter } from './muse/routes.js'
import { createImages } from './images/index.js'
import { createVideos } from './videos/index.js'
import { PUBLIC_VIDEO_PATH } from './videos/routes.js'
import { TextConfigStore, looksLikeImageModel } from './text/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Overridable so a deployment can put state on a mounted volume elsewhere, and
// so tests can run against a throwaway directory instead of real user data.
const DATA_DIR = process.env.MOCKY_DATA_DIR
  ? path.resolve(process.env.MOCKY_DATA_DIR)
  : path.join(__dirname, 'data')
const ROOT_DIR = path.join(__dirname, '..')
/** Built frontend. Declared here because /api/health reports on it. */
const dist = path.join(ROOT_DIR, 'dist')
try {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.accessSync(DATA_DIR, fs.constants.W_OK)
} catch (err) {
  console.error(
    `\nMocky cannot write to its data directory:\n  ${DATA_DIR}\n  ${err.message}\n\n` +
      'Accounts, sessions and projects all live there. Fix the permissions (or the\n' +
      'Docker volume mount) and start again.\n',
  )
  process.exit(1)
}

// ---- Muse (MCP host + inspiration engine) ----
// Lazy: importing/creating this spawns nothing. Servers start on first use.
const muse = createMuse({ rootDir: ROOT_DIR, dataDir: DATA_DIR })
muse.host.startAutoStart().catch(() => {}) // best-effort; never blocks boot

// ---- Muse image service + global Image Library ----
// Lazy: no provider probe or generation until a request hits /api/images.
const images = createImages({ dataDir: DATA_DIR })

// ---- Scroll-sequence videos ----
// Shares the admin config store with the image service (one Admin screen, one
// file) but nothing else: different provider, different storage shape, and a
// dependency on ffmpeg that the image path does not have. Lazy in the same way
// — nothing is probed until a request arrives.
const videos = createVideos({ dataDir: DATA_DIR, configStore: images.configStore })

// ---- Admin-configured text (LLM) provider ----
// When unset, the proxy keeps using the credentials the browser sends.
const textConfig = new TextConfigStore(DATA_DIR)

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
  // 0600: these files hold session tokens and password hashes. The default 0644
  // left them readable by every other account on the machine.
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 })
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

/**
 * Minimum length for a password being set or reset *today*.
 *
 * Accounts created before this existed were allowed 6 characters and still sign
 * in normally: the check lives on the write paths only, never on /api/login, so
 * raising the bar cannot lock anyone out of an account they already have.
 */
const MIN_NEW_PASSWORD = 8

function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex')
}
function makeUser(username, password, role = 'user', mustChangePassword = false) {
  const salt = crypto.randomBytes(16).toString('hex')
  return {
    id: crypto.randomUUID(),
    username,
    email: null,
    role,
    dashySub: null,
    salt,
    hash: hashPw(password, salt),
    // When an admin hands out the first password, the account is flagged so the
    // app can demand a new one at the first sign-in.
    mustChangePassword: Boolean(mustChangePassword),
    createdAt: Date.now(),
  }
}
/** Replace a user's credentials in place. Clears any pending forced change. */
function setPassword(user, password) {
  user.salt = crypto.randomBytes(16).toString('hex')
  user.hash = hashPw(password, user.salt)
  user.mustChangePassword = false
  user.passwordChangedAt = Date.now()
}
const publicUser = (u) => ({
  username: u.username,
  role: u.role || 'user',
  mustChangePassword: Boolean(u.mustChangePassword),
})
function verifyPw(user, password) {
  // SSO-only accounts have no password and cannot log in this way.
  if (!user.salt || !user.hash) return false
  const a = Buffer.from(hashPw(password, user.salt), 'hex')
  const b = Buffer.from(user.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---- app ----
const app = express()
// Advertising the framework and version buys an attacker a version-specific
// exploit list for free.
app.disable('x-powered-by')
// Behind a reverse proxy every request appears to come from 127.0.0.1, which
// collapsed the whole instance into a single rate-limit bucket: nine failed
// logins a minute locked everyone out. Off by default (direct exposure), set
// TRUST_PROXY=1 — or a hop count — when Nginx/Caddy/Traefik sits in front.
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v === 'true' || v === '1' ? 1 : v)
}
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
//
// The subpath allow-list lives in provider-proxy.js so the Vite dev middleware
// enforces it too. What is added here is authentication — but only when an
// admin has configured an instance-wide model. In that mode a request spends
// the *host's* credits, so it must belong to someone. With no admin provider
// the caller supplies its own key, and the original "your key never leaves your
// browser" mode is preserved.
app.use('/__provider', (req, res) => {
  if (textConfig.target(profileFromRequest(req)) && !currentUser(req)) {
    return res.status(401).json({ error: 'Sign in to use this instance’s model.' })
  }
  return handleProviderProxy(req, res, fetch, { resolveTarget: (profile) => textConfig.target(profile) })
})

app.use('/api', express.json({ limit: '25mb' }))

// ---- session helpers ----

/** How long a session stays valid. Refreshed on use (sliding expiry). */
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

function currentUser(req) {
  const token = req.cookies?.mocky_sess
  if (!token) return null
  const sessions = loadSessions()
  const sess = sessions[token]
  if (!sess) return null

  // `t` was written on every sign-in and read by nobody: sessions never expired
  // server-side, and sessions.json grew without bound. The cookie's maxAge is
  // only a hint to the browser — it is not a server-side control.
  const age = Date.now() - (sess.t || 0)
  if (age > SESSION_TTL_MS) {
    delete sessions[token]
    saveSessions(sessions)
    return null
  }
  // Sliding expiry, but only written once a day so an active session does not
  // rewrite the whole store on every request.
  if (age > 24 * 60 * 60 * 1000) {
    sess.t = Date.now()
    saveSessions(sessions)
  }
  return loadUsers().find((u) => u.id === sess.u) || null
}

/** Drop expired sessions at boot so the store does not accumulate forever. */
function pruneSessions() {
  const sessions = loadSessions()
  const now = Date.now()
  let removed = 0
  for (const [token, s] of Object.entries(sessions)) {
    if (now - (s?.t || 0) > SESSION_TTL_MS) {
      delete sessions[token]
      removed++
    }
  }
  if (removed) saveSessions(sessions)
  return removed
}

function setSession(res, userId, req) {
  const token = crypto.randomBytes(32).toString('hex')
  const sessions = loadSessions()
  sessions[token] = { u: userId, t: Date.now() }
  saveSessions(sessions)
  res.cookie('mocky_sess', token, {
    httpOnly: true,
    sameSite: 'lax',
    // Derived from the actual connection rather than NODE_ENV: a production
    // instance reached over plain HTTP on a LAN would otherwise set a Secure
    // cookie the browser then refuses to send, and sign-in silently fails.
    secure: Boolean(req?.secure),
    maxAge: SESSION_TTL_MS,
  })
}

/**
 * Drop every session of one user, optionally sparing a single token.
 *
 * A password change that leaves the old cookies working protects nobody: the
 * whole point of changing it is to lock out a device that already holds a valid
 * session. Returns how many were revoked.
 */
function revokeSessions(userId, keepToken = null) {
  const sessions = loadSessions()
  let removed = 0
  for (const [token, s] of Object.entries(sessions)) {
    if (s?.u === userId && token !== keepToken) {
      delete sessions[token]
      removed++
    }
  }
  if (removed) saveSessions(sessions)
  return removed
}

/**
 * Any signed-in user. Routes that spend the instance's model credits, read the
 * shared image library, or delete files were mounted before this existed and
 * were reachable by anyone who could open the port.
 */
function requireUser(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  req.user = user
  next()
}

function requireAdmin(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if ((user.role || 'user') !== 'admin') return res.status(403).json({ error: 'Admin only.' })
  req.user = user
  next()
}

// Liveness + readiness. The container healthcheck used to hit /api/config, which
// answers 200 from memory and therefore proves nothing: an instance whose data
// directory had gone read-only, or which was started without a build, reported
// itself perfectly healthy. This checks the two things that actually break.
app.get('/api/health', (req, res) => {
  const checks = { dataWritable: false, frontendBuilt: fs.existsSync(dist) }
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK)
    checks.dataWritable = true
  } catch {
    /* reported below */
  }
  const ok = checks.dataWritable && checks.frontendBuilt
  res.status(ok ? 200 : 503).json({
    ok,
    checks,
    // Named so an operator reading `docker inspect` output knows what to fix.
    detail: ok
      ? undefined
      : [
          !checks.dataWritable && `cannot write to ${DATA_DIR}`,
          !checks.frontendBuilt && 'dist/ is missing — run `npm run build`',
        ]
          .filter(Boolean)
          .join('; '),
  })
})

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
    // Whether an admin configured an instance-wide model (no secret exposed) —
    // lets Settings tell users their own provider fields are being overridden.
    textProvider: (() => {
      const t = textConfig.target()
      const insp = textConfig.target('inspiration')
      return {
        configured: Boolean(t),
        model: t ? t.model : null,
        provider: t ? t.id : null,
        // Only advertise a distinct inspiration model when it really differs.
        inspirationModel: insp && (!t || insp.model !== t.model) ? insp.model : null,
      }
    })(),
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
  setSession(res, user.id, req)
  res.json({ user: publicUser(user) })
})

app.post('/api/login', authRateLimit(8), (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = loadUsers().find((u) => u.username === username)
  if (!user || !verifyPw(user, password)) return res.status(401).json({ error: 'Invalid username or password.' })
  setSession(res, user.id, req)
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

// ---- account: change your own password ----
// Rate-limited like the other credential routes: the current password is a
// secret being guessed here, session or no session.
app.post('/api/account/password', requireUser, authRateLimit(8), (req, res) => {
  const current = String(req.body?.current || '')
  const next = String(req.body?.next || '')

  // Re-read from the store: req.user is a snapshot, and we are about to write.
  const users = loadUsers()
  const user = users.find((u) => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })
  if (!user.salt || !user.hash) {
    return res
      .status(400)
      .json({ error: 'Ce compte se connecte via Dashy : le mot de passe se change côté Dashy.' })
  }
  if (!verifyPw(user, current)) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' })
  if (next.length < MIN_NEW_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Le nouveau mot de passe doit faire au moins ${MIN_NEW_PASSWORD} caractères.` })
  }
  if (next === current) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’actuel.' })
  }

  setPassword(user, next)
  saveUsers(users)

  // Every other device is signed out, and the current session gets a brand-new
  // token rather than being spared: reusing the old one would leave the exact
  // cookie an attacker may have copied in circulation.
  revokeSessions(user.id)
  setSession(res, user.id, req)

  res.json({ ok: true, user: publicUser(user) })
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
  setSession(res, user.id, req)

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
    users: loadUsers().map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role || 'user',
      createdAt: u.createdAt,
      // Lets the admin list show which accounts still owe a password change.
      mustChangePassword: Boolean(u.mustChangePassword),
      // SSO-only accounts have no local password to reset.
      sso: Boolean(u.dashySub) && !u.salt && !u.hash,
    })),
  })
})

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const role = req.body?.role === 'admin' ? 'admin' : 'user'
  const mustChangePassword = req.body?.mustChangePassword === true
  if (username.length < 3) {
    return res.status(400).json({ error: 'Le nom d’utilisateur doit faire au moins 3 caractères.' })
  }
  // Stricter than public sign-up (6) on purpose: this password is chosen by
  // someone other than its owner and travels through a chat or a sticky note.
  if (password.length < MIN_NEW_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Le mot de passe doit faire au moins ${MIN_NEW_PASSWORD} caractères.` })
  }
  const users = loadUsers()
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà pris.' })
  }
  const user = makeUser(username, password, role, mustChangePassword)
  users.push(user)
  saveUsers(users)
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  })
})

// ---- admin: reset a user's password ----
// No confirmation by the admin's own password, on purpose: an admin who can
// already DELETE the account and everything in it gains nothing from a second
// prompt here — it only makes helping a locked-out colleague slower.
app.put('/api/admin/users/:id/password', requireAdmin, (req, res) => {
  const password = String(req.body?.password || '')
  const mustChange = req.body?.mustChange === true
  if (password.length < MIN_NEW_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Le mot de passe doit faire au moins ${MIN_NEW_PASSWORD} caractères.` })
  }
  const users = loadUsers()
  const user = users.find((u) => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })

  setPassword(user, password)
  if (mustChange) user.mustChangePassword = true
  saveUsers(users)

  // The target is signed out everywhere — a reset exists precisely for accounts
  // that may be compromised. When an admin resets their own password we hand
  // them a fresh cookie instead of bouncing them to the sign-in screen; the old
  // tokens die either way.
  const self = user.id === req.user.id
  revokeSessions(user.id)
  if (self) setSession(res, user.id, req)

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  })
})

// ---- admin: image-generation provider ----
// Lets an admin swap Pollinations for their own provider (OpenAI-compatible,
// Cloudflare Workers AI, or a local Automatic1111/Forge endpoint). Secrets are
// stored server-side and never sent back to the browser (see publicView()).
app.get('/api/admin/images/config', requireAdmin, (req, res) => {
  res.json(images.configStore.publicView())
})

app.put('/api/admin/images/config', requireAdmin, (req, res) => {
  images.configStore.update(req.body || {})
  images.reload() // swap providers + re-pace the queue immediately
  res.json(images.configStore.publicView())
})

// Really generates a small throwaway image (not stored) to prove the provider
// works end-to-end. Can test a provider before selecting it via ?provider=.
app.post('/api/admin/images/test', requireAdmin, async (req, res) => {
  const id = typeof req.body?.provider === 'string' ? req.body.provider : undefined
  const profile = req.body?.profile === 'inspiration' ? 'inspiration' : 'content'
  res.json(await images.testProvider(id, profile))
})

// ---- vision capability of the active text model ----
// Muse's "image as inspiration" mode only works if the model accepts images.
// Uses the instance provider when configured, else the credentials the browser
// sends (same headers as /__provider). Results are cached per model server-side.
app.post('/api/text/vision', requireUser, async (req, res) => {
  const { probeVision } = await import('./text/vision.js')
  // The inspiration IMAGE is attached to the generation request (that's the model
  // that must "see" it), so 'generation' is the profile that matters here. The
  // inspiration profile can be probed explicitly.
  const profile = req.body?.profile === 'inspiration' ? 'inspiration' : 'generation'
  let target = textConfig.target(profile)
  if (!target) {
    const baseUrl = String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
    const auth = String(req.headers['authorization'] || '')
    const model = String(req.body?.model || '')
    if (!baseUrl || !model) return res.json({ vision: false, error: 'Aucun modèle configuré.' })
    // This route takes a base URL straight from a request header and then makes
    // the server fetch it — the same shape as /__provider, but it was the one
    // path that never ran the SSRF guard, and probeVision echoes back up to 400
    // characters of the response body. That made it a readable port scanner.
    try {
      await assertSafeTargetResolved(`${baseUrl}/api/chat`)
    } catch (err) {
      return res.status(400).json({ vision: false, error: err instanceof Error ? err.message : String(err) })
    }
    target = { kind: 'ollama', baseUrl, apiKey: auth.startsWith('Bearer ') ? auth.slice(7) : '', model }
  }
  res.json({ ...(await probeVision(target, { force: req.body?.force === true })), model: target.model })
})

// ---- admin: text (LLM) provider ----
app.get('/api/admin/text/config', requireAdmin, (req, res) => {
  res.json(textConfig.publicView())
})

app.put('/api/admin/text/config', requireAdmin, (req, res) => {
  textConfig.update(req.body || {})
  res.json(textConfig.publicView())
})

// Sends a tiny real prompt through the configured provider (via the same
// dialect translation the app uses) so an admin knows it truly works.
app.post('/api/admin/text/test', requireAdmin, async (req, res) => {
  const profile = req.body?.profile === 'inspiration' ? 'inspiration' : 'generation'
  const target = textConfig.target(profile)
  if (!target) return res.json({ ok: false, error: 'Aucun fournisseur configuré.' })
  try {
    const { buildUpstream, fromOpenAiResponse } = await import('./text/dialect.js')
    const body = Buffer.from(
      JSON.stringify({
        model: target.model,
        stream: false,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        // Generous budget on purpose: reasoning models spend tokens thinking
        // before emitting any visible content, so a tight cap returns an empty
        // string and looks like a success when it is not.
        options: { num_predict: 512, temperature: 0 },
      }),
    )
    const plan = buildUpstream(target, '/api/chat', body)
    const upstream = await fetch(plan.url, { method: 'POST', headers: plan.headers, body: plan.body })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      // The most common misconfiguration by far: an IMAGE model id pasted into
      // the text field (fal sells both under one key). The provider answers a
      // bare "is not a valid model ID", which explains nothing on its own.
      if (looksLikeImageModel(target.model)) {
        return res.json({
          ok: false,
          error: `« ${target.model} » est un modèle d’IMAGES, pas un modèle de texte. Ce champ attend un LLM (ex. openai/gpt-4o-mini, google/gemini-2.5-flash, qwen/qwen3.5-flash-02-23). Pour générer des images, allez dans Admin → Génération d’images (Muse).`,
        })
      }
      return res.json({ ok: false, error: `HTTP ${upstream.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` })
    }
    const json = await upstream.json()
    const shaped = plan.translate ? fromOpenAiResponse(json) : json
    const reply = String(shaped?.message?.content ?? '').trim()
    const base = { provider: target.id, model: target.model, profile }

    if (reply) return res.json({ ...base, ok: true, reply: reply.slice(0, 120) })

    // HTTP 200 with no visible text is NOT a success: the model would produce
    // empty screens. Explain the two cases we can actually distinguish.
    const choice = json?.choices?.[0]
    const finish = choice?.finish_reason
    const thought = choice?.message?.reasoning_content || choice?.message?.reasoning
    const why = thought
      ? 'ce modèle « réfléchit » avant de répondre et n’a pas produit de texte visible'
      : finish === 'length'
        ? 'la réponse a été coupée par la limite de tokens'
        : 'le modèle a renvoyé un contenu vide'
    res.json({
      ...base,
      ok: false,
      error: `Connexion OK, mais aucune réponse texte (${why}${finish ? `, finish_reason: ${finish}` : ''}). Essayez un modèle non-« reasoning » — les écrans seraient vides avec celui-ci.`,
    })
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' })
  const users = loadUsers()
  if (!users.some((u) => u.id === id)) return res.status(404).json({ error: 'Compte introuvable.' })
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

// ---- Muse routes (MCP status + inspiration engine) ----
// A dossier run spends model tokens and, with useFetch, launches Chromium; both
// were reachable by anyone who could open the port.
//
// The guard is attached to the two subpaths the router actually serves rather
// than to the router's '/api' mount: mounting it on '/api' made it run for every
// later /api/* route too, which silently put the public image bytes behind auth.
app.use('/api/mcp', requireUser)
app.use('/api/muse', requireUser)
app.use(
  '/api',
  createMuseRouter({
    host: muse.host,
    fetcher: muse.fetcher,
    patterns: muse.patterns,
    blacklist: muse.blacklist,
    resolveTarget: (profile) => textConfig.target(profile),
  }),
)

// ---- Image service + Image Library (Phase 2) ----
//
// The library is instance-wide and its prompts are the briefs people typed.
// `GET /library` listed every one of them — along with the hashes needed to call
// `DELETE /:hash`, which really unlinks the file. Anonymous reading *and*
// anonymous destruction, both reachable from a single unauthenticated listing.
//
// Everything is therefore behind requireUser EXCEPT fetching the bytes of one
// known image. That exception is deliberate and load-bearing:
//   • preview iframes are sandboxed without allow-same-origin, so their origin
//     is opaque and their subresource requests carry no SameSite cookie — an
//     authenticated /:hash would blank out every image in every mockup;
//   • an exported ZIP references these URLs from a machine with no session.
// The URL is the capability: a 64-hex SHA-256 of the content, which cannot be
// guessed and is only ever handed out by the (authenticated) listing.
const PUBLIC_IMAGE_PATH = /^\/[a-f0-9]{64}$/

app.use(
  '/api/images',
  (req, res, next) => {
    if (req.method === 'GET' && PUBLIC_IMAGE_PATH.test(req.path)) return next()
    return requireUser(req, res, next)
  },
  // Generation is the expensive verb; browsing is not, so only the former is
  // throttled — 30/min is far above any human pace and far below what a runaway
  // loop or a stuck retry produces.
  (req, res, next) => {
    if (req.method === 'POST' && (req.path.startsWith('/generate') || req.path.startsWith('/upload'))) {
      return authRateLimit(30)(req, res, next)
    }
    next()
  },
  images.router,
)

// Same posture as /api/images: the picture bytes of a known sequence are public
// so a null-origin preview can fetch them; everything else needs a session, and
// generation — the expensive verb, minutes of provider time per call — is
// throttled harder than image generation because each call costs far more.
app.use(
  '/api/videos',
  (req, res, next) => {
    if (req.method === 'GET' && PUBLIC_VIDEO_PATH.test(req.path)) return next()
    return requireUser(req, res, next)
  },
  (req, res, next) => {
    // Generating is metered because it costs money; uploading is metered
    // because it costs disk and a few seconds of ffmpeg. Different ceilings.
    if (req.method === 'POST' && req.path.startsWith('/generate')) return authRateLimit(6)(req, res, next)
    if (req.method === 'POST' && req.path.startsWith('/upload')) return authRateLimit(20)(req, res, next)
    next()
  },
  videos.router,
)

// ---- serve the built frontend (production) ----
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/__provider') || req.path.startsWith('/sso'))
      return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
} else {
  // Without this warning the server starts happily and every page is a bare
  // 404 — the single most confusing way to run `npm start` before `npm run build`.
  console.warn(
    `\n  dist/ not found (${dist}).\n` +
      '  The API is up but there is no frontend to serve. Run `npm run build` first,\n' +
      '  or use `npm run dev:all` for development.\n',
  )
}

// MOCKY_PORT wins over the generic PORT so a dev harness that injects PORT (to
// tell Vite which port to use) can't accidentally push the backend onto the
// Vite port and collide with it. Production hosts that set PORT still work.
const PORT = process.env.MOCKY_PORT || process.env.PORT || 8787
const server = app.listen(PORT, () => {
  console.log(`Mocky backend on http://localhost:${PORT}`)
  const pruned = pruneSessions()
  if (pruned) console.log(`Sessions: pruned ${pruned} expired`)
  console.log(
    ssoEnabled
      ? `SSO: enabled (Dashy at ${SSO_DASHY_URL})`
      : 'SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)',
  )
})

// Without this, a busy port kills the process with a raw stack trace — and under
// `npm run dev:all` concurrently takes Vite down with it, so the visible symptom
// is "the dev server won't start" with no mention of the port.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use.\n` +
        '  Another Mocky (or another app) is running there. Stop it, or start Mocky on\n' +
        `  a different port:  MOCKY_PORT=8788 npm start\n`,
    )
  } else if (err.code === 'EACCES') {
    console.error(`\nNot allowed to listen on port ${PORT}. Ports below 1024 need elevated rights.\n`)
  } else {
    console.error(`\nMocky could not start: ${err.message}\n`)
  }
  process.exit(1)
})

// Graceful shutdown: close MCP servers (kill spawned children) before exiting.
let shuttingDown = false
async function gracefulShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n${signal} received — shutting down Muse MCP servers…`)
  try {
    await muse.host.shutdown()
  } catch {
    /* ignore */
  }
  server.close(() => process.exit(0))
  // Don't hang forever if a socket is stuck.
  setTimeout(() => process.exit(0), 3000).unref()
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => gracefulShutdown(sig))
}
