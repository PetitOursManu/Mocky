// Minimal self-hosted backend for Mocky: simple accounts + per-user data sync,
// a model-provider proxy (so production works without Vite), and static serving.
// Storage is plain JSON files under server/data — no database, no native deps.
import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProviderProxy, profileFromRequest, assertSafeTargetResolved, readRawBody } from './provider-proxy.js'
import { createMuse } from './muse/index.js'
import { createMuseRouter } from './muse/routes.js'
import { createImages } from './images/index.js'
import { createVideos } from './videos/index.js'
import { PUBLIC_VIDEO_PATH } from './videos/routes.js'
import { VideoConfigStore } from './video/config.js'
import { VideoQueue } from './video/queue.js'
import { createVideoWorker, collectImages } from './video/worker.js'
import { VideoExportStore } from './video/store.js'
import { totalDurationMs } from './video/timeline.js'
import { createVideoRouter, createVideoAdminRouter } from './video/routes.js'
import { TextConfigStore, looksLikeImageModel } from './text/config.js'
import { createLockout } from './auth-lockout.js'
import { createDiskBudget } from './storage-quota.js'
import { collectUsage } from './usage.js'
import { createShareStore } from './share.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- .env loader (no dependency) ----
// Reads KEY=VALUE lines from <repo>/.env into process.env (does not override
// existing values). Lets SSO_* be configured locally without adding dotenv.
//
// This runs FIRST, before anything reads process.env. It used to sit below
// DATA_DIR, which made MOCKY_DATA_DIR the one variable a .env could not set:
// state kept going to server/data while the admin backed up the mounted volume
// they thought they had configured.
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

// ---- disk budget ----
// Shared by everything here that grows without an upper bound from user input:
// the image library, the scroll-sequence library, and the exported films. A
// directory left out of this list is not exempt from filling the volume, only
// from being counted — which makes the ceiling wrong by however much it holds.
// Seeded once at boot rather than measured per request — see
// server/storage-quota.js.
const diskBudget = createDiskBudget({
  dirs: [
    path.join(DATA_DIR, 'image-library'),
    path.join(DATA_DIR, 'video-library'),
    path.join(DATA_DIR, 'video-exports'),
  ],
})

// ---- Muse image service + global Image Library ----
// Lazy: no provider probe or generation until a request hits /api/images.
const images = createImages({ dataDir: DATA_DIR, budget: diskBudget })

// ---- Scroll-sequence videos ----
// Shares the admin config store with the image service (one Admin screen, one
// file) but nothing else: different provider, different storage shape, and a
// dependency on ffmpeg that the image path does not have. Lazy in the same way
// — nothing is probed until a request arrives.
const videos = createVideos({ dataDir: DATA_DIR, configStore: images.configStore, budget: diskBudget })

// ---- Video export (Remotion worker) ----
//
// Note the singular: `server/video/` is the export pipeline, `server/videos/`
// above is the clip library that feeds scroll sequences into a mockup. Two
// features, one letter apart.
//
// Its own config store rather than the images one: the Remotion licence key and
// the export allowlist have nothing to do with an image provider, and the worker
// is an opt-in Docker service the rest of the app knows nothing about. Nothing
// here probes or spawns at boot — an instance that never turns the feature on
// pays for a file read that fails and a queue holding zero jobs.
const videoConfig = new VideoConfigStore(DATA_DIR)
const videoWorker = createVideoWorker({ config: videoConfig, fetchImpl: fetch })
/*
 * Where a finished render lands — its own store, NOT `videos.library`.
 *
 * The clip library exists to cut scroll sequences: `ingest` runs ffmpeg over
 * whatever it is given to produce up to 150 stills, and everything downstream of
 * its `list()` expects them. An exported film has no frames anybody will ever
 * display, so filing it there would pay for the cutting and then lie to every
 * consumer of that list. See the header of server/video/store.js.
 */
const videoExports = new VideoExportStore(DATA_DIR, { budget: diskBudget })
const videoQueue = new VideoQueue({
  dataDir: DATA_DIR,
  render: async (job, { signal }) => {
    const payload = collectImages(images.library, job.timeline)
    const out = await videoWorker.render(job.timeline, payload, { signal })
    /*
     * Stored here rather than by the queue, because the queue deliberately does
     * not judge a result: it turns a rejection into a job marked `error`, and
     * `put` throwing on a full volume is exactly that — a render that produced
     * bytes with nowhere to go has not succeeded, and a job saying `done` with
     * no `videoHash` would be a download button pointing at nothing.
     */
    const stored = videoExports.put(out.buffer, {
      owner: job.userId,
      // Carried by the job because nothing downstream could reconstruct it: the
      // store is content-addressed, so the bytes say what the film contains and
      // nothing about where it was cut. Without this the Media tab has no
      // question to ask, and a finished export is a file nobody can find.
      project: job.projectId || undefined,
      format: job.timeline.outputFormat,
      aspectRatio: job.timeline.aspectRatio,
      scenes: job.timeline.scenes.length,
      durationMs: totalDurationMs(job.timeline),
    })
    return { videoHash: stored.hash }
  },
})

// ---- Admin-configured text (LLM) provider ----
// When unset, the proxy keeps using the credentials the browser sends.
const textConfig = new TextConfigStore(DATA_DIR)

// ---- share links ----
// Kept next to the other stores: same directory, same atomic-write discipline.
const shares = createShareStore(DATA_DIR)

// ---- SSO ("Sign in with Dashy") config ----
// Mocky acts as a client app; Dashy is the identity provider. Disabled unless
// both env vars are set. SSO_SHARED_SECRET is the HS256 secret shared with Dashy
// (it MUST match Dashy's SSO_SHARED_SECRET); SSO_DASHY_URL is Dashy's public
// origin, e.g. https://dashy.example.com. The callback URL Mocky registers in
// Dashy's SSO_ALLOWED_REDIRECTS is `${MOCKY_ORIGIN}/sso/dashy/callback`.
const SSO_SHARED_SECRET = process.env.SSO_SHARED_SECRET || ''
const SSO_DASHY_URL = (process.env.SSO_DASHY_URL || '').replace(/\/+$/, '')
const MOCKY_ORIGIN = (process.env.MOCKY_ORIGIN || '').replace(/\/+$/, '')
// MOCKY_ORIGIN is required, not optional. The token's `aud` claim is the only
// thing stopping a token Dashy minted for ANOTHER client app — one that shares
// the same SSO_SHARED_SECRET — from being replayed here. Without MOCKY_ORIGIN
// the expected audience fell back to the caller's own Origin/Host header, so
// the caller chose the value it was going to be checked against.
const ssoEnabled = Boolean(SSO_SHARED_SECRET && SSO_DASHY_URL && MOCKY_ORIGIN)
if (SSO_SHARED_SECRET && SSO_DASHY_URL && !MOCKY_ORIGIN) {
  console.error(
    '\nMocky: SSO is configured but MOCKY_ORIGIN is not set, so SSO stays OFF.\n' +
      "  Set MOCKY_ORIGIN to this instance's public origin (e.g. https://mocky.example.com).\n",
  )
}

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
  /**
   * Whether this account has a picture, and when it last changed.
   *
   * The timestamp is the cache-buster: the avatar lives at one fixed URL per
   * account, so without it a replaced picture would keep showing the old one
   * until the browser felt like revalidating.
   */
  avatar: Boolean(u.avatarMime),
  avatarAt: u.avatarAt || 0,
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

// ---- security headers ----
//
// Still no Content-Security-Policy, and the reason is measurable rather than
// forgotten: a `srcdoc` iframe INHERITS its parent's policy. Verified in a
// browser — with `script-src 'unsafe-inline'; img-src 'none'` on the parent, a
// srcdoc child could no longer `eval` and could no longer load a remote image.
// Every preview is a srcdoc document that must run Babel at runtime
// (`unsafe-eval`) and must display the photos a mockup references (`img-src`).
// A policy strict enough to be worth having would therefore break every screen
// in the product. Closing that gap means serving previews from a real URL so
// they stop inheriting — a change to make deliberately, not as a side effect.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  // Nothing here needs a camera, a microphone or a location. Saying so costs
  // one header and removes them from anything embedded too.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  // Only over TLS, and only when the deployment says it is public: sending
  // HSTS from a LAN instance reached over plain HTTP would pin browsers to an
  // https:// URL that does not answer.
  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
  next()
})

/**
 * One line per authentication event, in a shape fail2ban can match.
 *
 * The IP counter alone was never a real defence against guessing: an attacker
 * with a handful of addresses simply spreads the attempts, and nothing on the
 * instance ever noticed. Two things fix that — a per-ACCOUNT lockout below, and
 * this: a log line that names the client address, so fail2ban can ban at the
 * firewall, which is the layer that can actually stop a distributed attempt.
 *
 * Format is fixed and boring on purpose; `deploy/fail2ban/mocky.conf` matches
 * it, so changing the wording here means changing the filter there.
 */
function logAuth(event, req, username) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const name = String(username || '').slice(0, 64).replace(/[\r\n]/g, '')
  console.log(`mocky auth ${event} user=${JSON.stringify(name)} ip=${ip}`)
}

/** Per-account lockout — see server/auth-lockout.js for why it is separate. */
const lockout = createLockout()
const accountLocked = (u) => lockout.lockedFor(u)
const noteAuthFailure = (u) => lockout.fail(u)
const clearAuthFailures = (u) => lockout.succeed(u)

// ---- rate-limit on auth-sensitive routes (in-memory, per IP) ----
// Simple sliding-window counter: max `limit` hits per `windowMs` per IP. No
// dependency, no Redis — fine for a self-hosted single-instance deployment.
//
// The bucket key carries a `name` as well as the IP. Keyed on the IP alone,
// every route shared one counter and only the threshold differed: five wrong
// passwords consumed the video quota, and eight perfectly legitimate image
// generations locked the user out of /api/login for a minute.
const authLimits = new Map() // `${name}|${ip}` → { t, count }
function authRateLimit(limit = 8, windowMs = 60_000, name = 'auth') {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const key = `${name}|${ip}`
    const now = Date.now()
    let bucket = authLimits.get(key)
    if (!bucket || now - bucket.t > windowMs) {
      bucket = { t: now, count: 0 }
      authLimits.set(key, bucket)
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
// Authentication is unconditional. It used to apply only when an admin had
// configured an instance model — which is not the default install — leaving an
// unauthenticated outbound relay: anyone who could reach the port made the
// server POST up to 25 MB to any public host, from the owner's home IP.
// Mocky requires an account to do anything anyway, so nothing legitimate loses
// access.
app.use('/__provider', (req, res) => {
  if (!currentUser(req)) {
    return res.status(401).json({ error: 'Sign in to use this instance’s model.' })
  }
  // Never hand the promise to Express 4: it does not observe rejections, so one
  // provider cutting a stream mid-answer terminated the process.
  handleProviderProxy(req, res, fetch, { resolveTarget: (profile) => textConfig.target(profile) }).catch(
    (err) => {
      console.error('mocky: provider proxy failed —', err?.message || err)
      if (!res.headersSent) res.status(502).json({ error: 'Proxy request failed' })
      else res.destroy()
    },
  )
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

/**
 * Whether this request reached us over TLS, from every signal available.
 * `req.secure` only reflects reality when Express trusts the proxy; the
 * forwarded header covers the untrusted-proxy case, and MOCKY_ORIGIN covers the
 * deployment that declared itself https regardless of either.
 */
function isHttps(req) {
  if (req?.secure) return true
  const fwd = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  if (fwd === 'https') return true
  return MOCKY_ORIGIN.startsWith('https://')
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
    //
    // `req.secure` alone was not enough. It only tells the truth when Express
    // trusts the proxy, and TRUST_PROXY is unset by default — so the deployment
    // the README recommends (Caddy/Nginx terminating TLS, plain HTTP to Mocky on
    // loopback) handed out a 90-day session cookie with no Secure flag, while
    // believing it had set one.
    secure: isHttps(req),
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
  // Reported, never fatal. A full library stops new media from being stored,
  // but everything else — sign-in, projects, generation — keeps working, so
  // failing the healthcheck would restart a container that is doing its job.
  // The operator needs to SEE it coming, which is what a ratio is for.
  const storage = diskBudget.usage()
  checks.storage = {
    usedBytes: storage.bytes,
    maxBytes: storage.maxBytes,
    percent: storage.ratio == null ? null : Math.round(storage.ratio * 100),
    full: storage.ratio != null && storage.ratio >= 1,
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
app.post('/api/register', authRateLimit(8, 60_000, 'register'), (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
  // The public sign-up form is the one path an attacker can reach without a
  // session, and it used to be the most lenient of the three: 6 characters here
  // against MIN_NEW_PASSWORD everywhere else. The account it creates on a fresh
  // instance is the admin.
  if (password.length < MIN_NEW_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_NEW_PASSWORD} characters.` })
  }
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
  // Close the door behind the first account. Leaving public sign-ups on by
  // default meant anyone who could reach the instance made themselves an
  // account and spent the owner's model credits. The admin re-opens it from the
  // Admin screen if they actually want to invite people.
  if (isFirst) {
    try {
      saveConfig({ ...loadConfig(), allowRegistration: false })
    } catch (err) {
      console.error('mocky: could not close public sign-ups after the first account —', err.message)
    }
  }
  setSession(res, user.id, req)
  res.json({ user: publicUser(user) })
})

app.post('/api/login', authRateLimit(8, 60_000, 'login'), (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  const lockedFor = accountLocked(username)
  if (lockedFor) {
    logAuth('locked', req, username)
    res.setHeader('Retry-After', String(lockedFor))
    return res.status(429).json({
      error: `Too many failed attempts on this account. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
    })
  }

  const user = loadUsers().find((u) => u.username === username)
  if (!user || !verifyPw(user, password)) {
    // Counted against the account even when it does not exist: otherwise the
    // response time and the lockout behaviour together say which usernames are
    // real, which is half of what a guesser is after.
    noteAuthFailure(username)
    logAuth('failure', req, username)
    return res.status(401).json({ error: 'Invalid username or password.' })
  }
  clearAuthFailures(username)
  logAuth('success', req, username)
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
// ---- account picture ----
//
// The header showed a generic person glyph for everybody, which on a shared
// instance tells you nothing about who you are signed in as. A picture is the
// cheapest possible answer to that.
//
// Stored as a file next to the JSON stores rather than base64 inside users.json:
// that file is read on EVERY authenticated request (currentUser → loadUsers), so
// putting a few hundred kilobytes of image in it would tax every single call.
const AVATAR_DIR = path.join(DATA_DIR, 'avatars')
const ACCEPTED_AVATAR = /^image\/(jpeg|png|webp|gif|avif)$/i
/** Small on purpose: it is rendered at 24px. Anything larger is the user's photo app's problem. */
const MAX_AVATAR_BYTES = 512 * 1024

const avatarPath = (id) => path.join(AVATAR_DIR, String(id).replace(/[^a-zA-Z0-9-]/g, ''))

app.post('/api/account/avatar', requireUser, authRateLimit(20, 60_000, 'avatar'), async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  // An allow-list, like the image library: these bytes are served back from
  // Mocky's own origin, and SVG carries script.
  if (!ACCEPTED_AVATAR.test(mime)) {
    return res.status(415).json({ error: `Unsupported image type "${mime || 'unknown'}".` })
  }
  try {
    const buffer = await readRawBody(req, MAX_AVATAR_BYTES)
    fs.mkdirSync(AVATAR_DIR, { recursive: true })
    fs.writeFileSync(avatarPath(req.user.id), buffer, { mode: 0o600 })
    const users = loadUsers()
    const u = users.find((x) => x.id === req.user.id)
    if (!u) return res.status(404).json({ error: 'Compte introuvable.' })
    u.avatarMime = mime
    u.avatarAt = Date.now()
    saveUsers(users)
    res.json({ user: publicUser(u) })
  } catch (err) {
    res.status(err?.statusCode === 413 ? 413 : 400).json({
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

app.get('/api/account/avatar', requireUser, (req, res) => {
  const users = loadUsers()
  const u = users.find((x) => x.id === req.user.id)
  if (!u?.avatarMime) return res.status(404).end()
  let bytes
  try {
    bytes = fs.readFileSync(avatarPath(u.id))
  } catch {
    return res.status(404).end()
  }
  res.setHeader('Content-Type', u.avatarMime)
  // Immutable for a day: the URL carries ?v=<avatarAt>, so a replacement is a
  // different URL and this never serves a stale face.
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.end(bytes)
})

app.delete('/api/account/avatar', requireUser, (req, res) => {
  const users = loadUsers()
  const u = users.find((x) => x.id === req.user.id)
  if (!u) return res.status(404).json({ error: 'Compte introuvable.' })
  try {
    fs.rmSync(avatarPath(u.id), { force: true })
  } catch {
    /* already gone — the record is what matters */
  }
  delete u.avatarMime
  u.avatarAt = Date.now()
  saveUsers(users)
  res.json({ user: publicUser(u) })
})

app.post('/api/account/password', requireUser, authRateLimit(8, 60_000, 'password'), (req, res) => {
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
  if (!verifyPw(user, current)) {
    // The current password is a secret being guessed here too, session or not.
    noteAuthFailure(user.username)
    logAuth('failure', req, user.username)
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' })
  }
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
app.get('/sso/dashy/callback', (req, res, next) => {
  // The disabled check runs BEFORE the limiter. The other way round, nine hits
  // on a route that answers 404 consumed the shared budget and locked sign-in.
  if (!ssoEnabled) return res.status(404).send('SSO is not enabled')
  return authRateLimit(15, 60_000, 'sso')(req, res, next)
}, (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  if (!token) return res.status(400).send('Missing token')

  // Our own public origin, used to validate the token's `aud` claim. SSO does
  // not switch on without it (see ssoEnabled), so there is no fallback here:
  // the previous one read the caller's Origin/Host header, which let the caller
  // pick the audience it would be checked against. In dev (Vite proxy on :8787
  // → SPA on :5173) set it to the SPA origin, e.g. http://localhost:5173.
  const expectedAudience = MOCKY_ORIGIN

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

/**
 * Who is using the instance, and how much of it.
 *
 * Separate from GET /api/admin/users because it costs something: it parses
 * every user's projects blob — the one thing the server otherwise treats as an
 * opaque string — and walks a directory per scroll sequence. Folding that into
 * the account list would make opening the Admin tab pay for it whether or not
 * anyone looked.
 *
 * The reply is deliberately not a single number per person: see server/usage.js
 * for why deduplicated media is split between its owners and why anything
 * generated before ownership was recorded gets its own line instead of a guess.
 */
app.get('/api/admin/usage', requireAdmin, (req, res) => {
  try {
    res.json(
      collectUsage({
        dataDir: DATA_DIR,
        users: loadUsers(),
        images: images.library,
        videos: videos.library,
        videoExports,
        instance: diskBudget.usage(),
      }),
    )
  } catch (err) {
    // A report is not worth a 500 on the Admin screen: the account list beside
    // it still works, and the panel degrades to "usage unavailable".
    res.status(200).json({
      users: [],
      unattributed: { bytes: 0, count: 0 },
      instance: null,
      error: err instanceof Error ? err.message : String(err),
    })
  }
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
  const profile = req.body?.profile === 'inspiration' || req.body?.profile === 'edit' ? req.body.profile : 'content'
  res.json(await images.testProvider(id, profile))
})

// ---- vision capability of the active text model ----
// Muse's "image as inspiration" mode only works if the model accepts images.
// Uses the instance provider when configured, else the credentials the browser
// sends (same headers as /__provider). Results are cached per model server-side.
app.post('/api/text/vision', requireUser, authRateLimit(20, 60_000, 'vision'), async (req, res) => {
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

/**
 * What models this key can actually reach.
 *
 * The model was a free-text field, so every provider change meant leaving the
 * app to look up an id, and a typo came back as a bare "is not a valid model
 * ID". Every piece needed for this already existed — `buildUpstream` maps
 * /api/tags to /v1/models, `fromOpenAiModels` reshapes the answer — and because
 * it goes through the dialect it works for every provider at once, including
 * one an admin wired up by hand through "OpenAI compatible".
 */
app.post('/api/admin/text/models', requireAdmin, authRateLimit(20, 60_000, 'text-models'), async (req, res) => {
  const profile = req.body?.profile === 'inspiration' ? 'inspiration' : 'generation'
  const target = textConfig.target(profile)
  // The listing runs against the SAVED configuration — the key never travels in
  // this request. Say so, or "no provider configured" reads as a bug when the
  // admin has just typed a key and not pressed Save.
  if (!target) {
    return res.json({
      ok: false,
      error: 'Enregistrez d’abord le fournisseur et sa clé : la liste est demandée avec la configuration sauvegardée.',
    })
  }
  try {
    const { buildUpstream, fromOpenAiModels } = await import('./text/dialect.js')
    const plan = buildUpstream(target, '/api/tags', undefined)
    // A listing is a cheap GET; it must not be able to hang the Admin screen.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15_000)
    let upstream
    try {
      upstream = await fetch(plan.url, { method: 'GET', headers: plan.headers, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      return res.json({
        ok: false,
        error:
          upstream.status === 404
            ? `Ce fournisseur n’expose pas de liste de modèles (HTTP 404 sur ${plan.url}). Saisissez l’identifiant à la main.`
            : `HTTP ${upstream.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      })
    }
    const json = await upstream.json()
    const shaped = plan.translate ? fromOpenAiModels(json) : json
    // Both dialects land on { models: [{ name }] }; Ollama also sends `model`.
    const models = (Array.isArray(shaped?.models) ? shaped.models : [])
      .map((m) => String(m?.name || m?.model || '').trim())
      .filter(Boolean)
      // Image and video ids share the catalogue on some providers, and pasting
      // one into the text field is the single most common misconfiguration.
      .filter((id) => !looksLikeImageModel(id))
      .sort((a, b) => a.localeCompare(b))
    if (!models.length) {
      return res.json({ ok: false, error: 'Le fournisseur a répondu, mais sans aucun modèle de texte utilisable.' })
    }
    res.json({ ok: true, provider: target.id, profile, models: models.slice(0, 500) })
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'Le fournisseur n’a pas répondu en 15 s.' : String(err?.message || err)
    res.json({ ok: false, error: msg })
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
  // Their share links go too. A capability URL outlives the account that minted
  // it otherwise — a deleted user's screens would stay readable by anyone
  // holding a link, which is not what "delete this account" means to anybody.
  shares.revokeAllFor(id)
  res.json({ ok: true })
})

// ---- share links (one screen, no account, expires) ----
//
// GET /api/share/:token is the one route here that is deliberately public: the
// token IS the authority, exactly like the content-addressed image bytes above.
// Everything that MINTS or LISTS a link needs a session, because those are the
// operations that decide what becomes readable.
app.post('/api/share', requireUser, authRateLimit(20, 60_000, 'share'), (req, res) => {
  try {
    const out = shares.create(req.user.id, req.body || {}, req.body?.ttl)
    res.json({
      token: out.token,
      expiresAt: out.expiresAt,
      // Built from MOCKY_ORIGIN when set, so a link scanned on a phone points at
      // the instance's real address rather than at whatever host header the
      // browser happened to use.
      url: `${MOCKY_ORIGIN || `${req.protocol}://${req.get('host')}`}/s/${out.token}`,
    })
  } catch (err) {
    res.status(err?.statusCode || 400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/share', requireUser, (req, res) => {
  res.json({ shares: shares.list(req.user.id) })
})

app.delete('/api/share/:token', requireUser, (req, res) => {
  res.json({ revoked: shares.revoke(req.user.id, req.params.token) })
})

app.get('/api/share/:token', (req, res) => {
  const snap = shares.get(req.params.token)
  // Same answer for "never existed", "expired" and "revoked". Telling them
  // apart would confirm that a token was once real, which is the only thing
  // someone probing this route could hope to learn.
  if (!snap) return res.status(404).json({ error: 'This link has expired or was revoked.' })
  // Never cached: the whole point is that it stops working on time.
  res.setHeader('Cache-Control', 'no-store')
  res.json(snap)
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
// A dossier is the most expensive verb in the app — up to six page fetches, a
// Chromium instance, and a handful of model round-trips. It was the only
// expensive route with no ceiling at all, while image generation had one.
app.use('/api/muse/dossier', authRateLimit(10, 60_000, 'muse-dossier'))
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
      return authRateLimit(30, 60_000, 'images')(req, res, next)
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
    if (req.method === 'POST' && req.path.startsWith('/generate'))
      return authRateLimit(6, 60_000, 'video-generate')(req, res, next)
    if (req.method === 'POST' && req.path.startsWith('/upload'))
      return authRateLimit(20, 60_000, 'video-upload')(req, res, next)
    next()
  },
  videos.router,
)

// ---- Video export (/api/video, singular) ----
//
// No public path at all, unlike its two neighbours: this router serves status,
// a queue and job documents, and a job carries the timeline somebody composed.
// There is nothing here a null-origin preview needs, so the exception those two
// make does not apply.
//
// The rate limit is the only bound on how deep the queue can go — VideoQueue
// never evicts a job that has not finished, on purpose, so nothing else stops a
// loop from filling it. Six a minute is far above composing a timeline by hand
// and far below what a stuck retry produces; the queue runs one at a time
// anyway, so a burst only costs memory, never CPU.
app.use(
  '/api/video',
  /*
   * The BYTES of a finished film are public; everything else needs a session.
   *
   * Third time this instance makes that trade, and the argument is the one
   * written above `PUBLIC_IMAGE_PATH` and repeated for the clip library: the URL
   * IS the capability. A 64-hex SHA-256 of the content cannot be guessed, and it
   * is only ever handed out by a listing that does require a session — the
   * export list, the job, the panel.
   *
   * It exists because a film has to be watchable inside a generated screen, and
   * that screen renders in an iframe with `sandbox="allow-scripts"` and no
   * `allow-same-origin` (I2, I3). Its document has an opaque origin, so nothing
   * it fetches can be authenticated by anything the page knows. Either the bytes
   * are reachable without a session or a film cannot appear in a mockup at all —
   * which is the state this route was in, and the reason a hero came back empty.
   *
   * What does NOT open, and the narrowness is the point:
   *  - the path shape is exactly one hash, so `/exports`, `/jobs/:id`, `/status`
   *    and every POST stay behind `requireUser`;
   *  - GET only, so `DELETE /api/video/:hash` still proves ownership before it
   *    removes anything;
   *  - the route below still answers 404 for a hash this instance never stored,
   *    so this is not a probe for what other people have rendered — it is a
   *    lookup for a string you were already given.
   */
  (req, res, next) => {
    if (req.method === 'GET' && PUBLIC_IMAGE_PATH.test(req.path)) return next()
    return requireUser(req, res, next)
  },
  (req, res, next) => {
    if (req.method === 'POST' && req.path.startsWith('/render')) {
      return authRateLimit(6, 60_000, 'video-render')(req, res, next)
    }
    // Composing costs a model call rather than minutes of CPU, so the ceiling is
    // its own: high enough to iterate on a brief — "shorter", "calmer", "start
    // with the packshot" — and low enough that a retry loop cannot bill an
    // account's provider key in a tight circle.
    if (req.method === 'POST' && req.path.startsWith('/compose')) {
      return authRateLimit(12, 60_000, 'video-compose')(req, res, next)
    }
    // One request here is up to six provider calls and six files on the volume,
    // so it is metered like /api/videos/generate rather than like /compose:
    // the per-image limiter on /api/images is no help, because these calls never
    // pass through that router.
    if (req.method === 'POST' && req.path.startsWith('/variants')) {
      return authRateLimit(6, 60_000, 'video-variants')(req, res, next)
    }
    next()
  },
  createVideoRouter({
    config: videoConfig,
    queue: videoQueue,
    worker: videoWorker,
    imageLibrary: images.library,
    store: videoExports,
    budget: diskBudget,
    resolveTarget: (profile) => textConfig.target(profile),
    // `registryFor` is a live closure over the registries, so an admin switching
    // the edit provider takes effect on the next request; capturing
    // `registries.edit` here instead would pin whatever was configured at boot,
    // and reload() would appear to do nothing.
    imageRegistryFor: images.registryFor,
  }),
)

// The worker is handed to the admin router too, so the panel that owns the URL
// field can probe it: an admin is not implicitly on the allowlist, so the
// per-account /api/video/status would answer them "no-access" instead.
app.use('/api/admin/video', requireAdmin, createVideoAdminRouter({ config: videoConfig, worker: videoWorker }))

// ---- serve the built frontend (production) ----
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      // Vite fingerprints everything under /assets (index-CNtvTjn8.js), so those
      // names change whenever the contents do and can be cached permanently.
      // With no cache headers at all, every reload revalidated the lot — 3 MB of
      // Babel included — which on a home server over a slow link is the whole
      // start-up cost, paid again each time for bytes that had not changed.
      // Everything else (index.html, the favicon, public/vendor) keeps its name
      // across releases, so it must be revalidated or an update never lands.
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    }),
  )
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/__provider') || req.path.startsWith('/sso'))
      return next()
    // Never cached: this is the document that names the fingerprinted bundles,
    // so a stale copy pins the browser to the previous release forever.
    res.setHeader('Cache-Control', 'no-cache')
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
// Which interface to listen on. Loopback by default: `app.listen(PORT)` with no
// host binds every interface, so `npm start` put an instance with open sign-ups
// — whose first account is the admin — on the LAN for anyone to claim.
//
// Distinct from MOCKY_BIND, which is the HOST-side publish address in
// docker-compose. Inside a container the server must listen on 0.0.0.0 or the
// published port reaches nothing, so the image sets MOCKY_HOST=0.0.0.0 and the
// loopback default protects source installs, which have no such indirection.
const HOST = process.env.MOCKY_HOST || '127.0.0.1'

/**
 * Whether we are running inside a container, so the boot message can tell the
 * truth about what 0.0.0.0 means here. Both markers are the standard ones:
 * Docker creates /.dockerenv, and Podman/OCI runtimes set container=.
 */
function inContainer() {
  if (process.env.container) return true
  try {
    return fs.existsSync('/.dockerenv')
  } catch {
    return false
  }
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Mocky backend on http://localhost:${PORT}`)
  if (HOST === '127.0.0.1' || HOST === 'localhost') {
    console.log('Listening on loopback only. Set MOCKY_HOST=0.0.0.0 to reach it from another machine.')
  } else if (inContainer()) {
    // Do NOT warn here. 0.0.0.0 is the only value that works inside a
    // container — the published port reaches nothing otherwise — so a scary
    // line at every boot would be both wrong and unactionable. What actually
    // limits access is the host side of the port mapping.
    console.log(`Listening on ${HOST} (normal in Docker — access is limited by MOCKY_BIND on the host side).`)
  } else {
    console.log(
      `Listening on ${HOST} — reachable from your network.\n` +
        '  Anyone who can reach this port can spend the model credits this instance pays for.\n' +
        '  Put it behind a reverse proxy, or set MOCKY_HOST=127.0.0.1 to close it again.',
    )
  }
  const pruned = pruneSessions()
  if (pruned) console.log(`Sessions: pruned ${pruned} expired`)
  console.log(
    ssoEnabled
      ? `SSO: enabled (Dashy at ${SSO_DASHY_URL})`
      : 'SSO: disabled (set SSO_SHARED_SECRET, SSO_DASHY_URL and MOCKY_ORIGIN in .env to enable)',
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
