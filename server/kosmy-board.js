// "Se connecter avec Kosmy Board" — Mocky as an OpenID Connect client.
//
// Kosmy Board is the user's own space that gathers the admin panels of their
// self-hosted instances, and a standard OpenID Connect provider. The contract
// is its `docs/integration.md`; the Kosmy convention fixes the two addresses:
//
//   {base}/auth/kosmy-board/login     launch (also "Ouvrir" in the Board:
//                                     third-party initiated login, `iss` +
//                                     `target_link_uri`)
//   {base}/auth/kosmy-board/callback  return (authorization code + PKCE)
//
// Separate from "Sign in with Dashy" (`/sso/dashy/callback`, HS256 with a shared
// secret, set in .env). This one is configured from Admin → Users, stored in
// config.json, and asks nothing of the environment.
//
// No dependency: the ID token is RS256, verified with node:crypto against the
// Board's `jwks_uri` — the same choice the Dashy path made for HS256.
//
// What this file refuses to do, each for a reason:
//  - match an account by e-mail. The Board never verifies addresses
//    (`email_verified` is always false), so an e-mail match would let anyone
//    who types somebody else's address into their Board take that account.
//    Accounts are matched on `sub` ONLY (`kosmySub` on the user record).
//  - grant administrator rights. An account created on first sign-in (off by
//    default) is always a plain `user`.
//  - redirect anywhere but this instance: `target_link_uri` is same-origin only.

import crypto from 'node:crypto'
import express from 'express'

export const LOGIN_PATH = '/auth/kosmy-board/login'
export const CALLBACK_PATH = '/auth/kosmy-board/callback'
/** Holds the flow's `state`, binding the return to the browser that started it. */
export const FLOW_COOKIE = 'mocky_kb_flow'
export const FLOW_TTL_MS = 10 * 60 * 1000
const MAX_PENDING_FLOWS = 2000
const DISCOVERY_TTL_MS = 60 * 60 * 1000
/** A key the JWKS does not have is looked up again, but not more often than this. */
const JWKS_REFRESH_MIN_MS = 30 * 1000
const CLOCK_SKEW_S = 60
const FETCH_TIMEOUT_MS = 10_000
/** The admin token's header `typ` (kosmy.board-admin.v1): what tells it from an ID token. */
export const ADMIN_TOKEN_TYP = 'kb-admin+jwt'
/** The admin protocol's own tolerance — tighter than sign-in's: its tokens live 60 s. */
const ADMIN_CLOCK_SKEW_S = 30
const ADMIN_MAX_AGE_S = 120

/* ---------- small helpers ---------- */

/** Trim, drop trailing slashes; null for anything that is not a plain http(s) URL. */
export function normalizeIssuer(value) {
  const v = String(value ?? '').trim().replace(/\/+$/, '')
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.search || u.hash || u.username || u.password) return null
    return v
  } catch {
    return null
  }
}

export const redirectUri = (base) => `${base}${CALLBACK_PATH}`
export const initiateLoginUri = (base) => `${base}${LOGIN_PATH}`

/**
 * Where to land after signing in. Only a page of this instance (same origin) is
 * accepted; anything else lands on `/`. Without this, the launch route is an
 * open redirect anyone can put in a link.
 */
export function safeTarget(target, base) {
  if (!target) return '/'
  try {
    const origin = new URL(base).origin
    const u = new URL(String(target), base)
    if (u.origin !== origin) return '/'
    const p = u.pathname + u.search
    if (!p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return '/'
    return p
  } catch {
    return '/'
  }
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

/** PKCE S256: BASE64URL(SHA-256(verifier)). */
export const codeChallenge = (verifier) => crypto.createHash('sha256').update(verifier).digest('base64url')

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ''))
  const bb = Buffer.from(String(b ?? ''))
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb)
}

/** HTTP Basic client credentials (RFC 6749 §2.3.1: form-urlencoded, then base64). */
export function basicAuthHeader(clientId, clientSecret) {
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+')
  return `Basic ${Buffer.from(`${enc(clientId)}:${enc(clientSecret)}`).toString('base64')}`
}

/** A short code carried in the address to pick the message shown; never free text. */
export class KosmyError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/* ---------- settings (config.json → `kosmyBoard`) ---------- */

/** The stored settings, normalised. `ready` = enough to run the flow. */
export function settingsOf(cfg) {
  const s = cfg?.kosmyBoard || {}
  const issuer = normalizeIssuer(s.issuer)
  const clientId = typeof s.clientId === 'string' ? s.clientId.trim() : ''
  const clientSecret = typeof s.clientSecret === 'string' ? s.clientSecret : ''
  return {
    issuer,
    clientId,
    clientSecret,
    autoCreate: s.autoCreate === true,
    ready: Boolean(issuer && clientId && clientSecret),
  }
}

/** What Admin shows. The secret is write-only: only whether one is stored. */
export function adminView(cfg, base, { originSet = true } = {}) {
  const s = settingsOf(cfg)
  return {
    issuer: s.issuer || '',
    clientId: s.clientId,
    hasSecret: Boolean(s.clientSecret),
    autoCreate: s.autoCreate,
    enabled: s.ready,
    redirectUri: redirectUri(base),
    initiateLoginUri: initiateLoginUri(base),
    originSet,
  }
}

/**
 * Apply an Admin form to the stored settings. An empty secret keeps the stored
 * one (it is never sent back to the page, so the field is always empty).
 * Returns `{ next, changed }` or `{ error }`.
 */
export function mergeSettings(current, body) {
  const prev = current && typeof current === 'object' ? current : {}
  const next = { ...prev }
  const changed = []
  if (body?.issuer !== undefined) {
    const raw = String(body.issuer ?? '').trim()
    const issuer = raw ? normalizeIssuer(raw) : ''
    if (issuer === null) return { error: 'issuer' }
    if (issuer !== (prev.issuer || '')) changed.push('issuer')
    next.issuer = issuer
  }
  if (body?.clientId !== undefined) {
    const clientId = String(body.clientId ?? '').trim().slice(0, 200)
    if (clientId !== (prev.clientId || '')) changed.push('clientId')
    next.clientId = clientId
  }
  if (typeof body?.clientSecret === 'string' && body.clientSecret.trim()) {
    next.clientSecret = body.clientSecret.trim().slice(0, 500)
    changed.push('clientSecret')
  }
  if (typeof body?.autoCreate === 'boolean') {
    if (body.autoCreate !== (prev.autoCreate === true)) changed.push('autoCreate')
    next.autoCreate = body.autoCreate
  }
  return { next, changed }
}

/* ---------- the OpenID Connect client ---------- */

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

/**
 * Discovery, code exchange and ID token verification. `fetchImpl` and `now` are
 * injectable so the tests run against a fake provider and a fake clock.
 */
export function createOidcClient({ fetchImpl = fetch, now = () => Date.now() } = {}) {
  /** issuer → { doc, at, keys: { list, at } } */
  const cache = new Map()

  async function getJson(url, init = {}) {
    const res = await fetchImpl(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const body = await res.json().catch(() => ({}))
    return { res, body }
  }

  async function discover(issuer) {
    const hit = cache.get(issuer)
    if (hit && now() - hit.at < DISCOVERY_TTL_MS) return hit.doc
    let res, doc
    try {
      ;({ res, body: doc } = await getJson(`${issuer}/.well-known/openid-configuration`))
    } catch (e) {
      throw new KosmyError('unreachable', `discovery failed: ${e.message}`)
    }
    if (!res.ok) throw new KosmyError('unreachable', `discovery failed (HTTP ${res.status})`)
    // The document must name the issuer it was fetched for: anything else is a
    // different provider answering at this address.
    if (doc?.issuer !== issuer) throw new KosmyError('issuer', 'discovery: issuer mismatch')
    for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
      if (typeof doc[k] !== 'string') throw new KosmyError('unreachable', `discovery: missing ${k}`)
    }
    cache.set(issuer, { doc, at: now(), keys: null })
    return doc
  }

  async function loadKeys(issuer, doc) {
    let res, body
    try {
      ;({ res, body } = await getJson(doc.jwks_uri))
    } catch (e) {
      throw new KosmyError('unreachable', `jwks: ${e.message}`)
    }
    if (!res.ok || !Array.isArray(body?.keys)) throw new KosmyError('unreachable', `jwks failed (HTTP ${res.status})`)
    const list = body.keys.filter((k) => k && k.kty === 'RSA' && k.use !== 'enc' && (!k.alg || k.alg === 'RS256'))
    const entry = cache.get(issuer)
    if (entry) entry.keys = { list, at: now() }
    return list
  }

  /** The public key for `kid`, fetching the JWKS again (rate-limited) on a miss — key rotation. */
  async function keyFor(issuer, doc, kid) {
    const entry = cache.get(issuer)
    let list = entry?.keys?.list
    const pick = (l) => (kid ? l.find((k) => k.kid === kid) : l.length === 1 ? l[0] : undefined)
    let jwk = list ? pick(list) : undefined
    if (!jwk && (!entry?.keys || now() - entry.keys.at > JWKS_REFRESH_MIN_MS)) {
      list = await loadKeys(issuer, doc)
      jwk = pick(list)
    }
    if (!jwk) throw new KosmyError('token', 'no matching signing key')
    try {
      return crypto.createPublicKey({ key: jwk, format: 'jwk' })
    } catch {
      throw new KosmyError('token', 'unusable signing key')
    }
  }

  function authorizationUrl(doc, { clientId, redirectUri: ru, state, nonce, verifier }) {
    const url = new URL(doc.authorization_endpoint)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: ru,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString()
    return url.href
  }

  /** client_secret_basic + PKCE verifier. Returns the raw ID token. */
  async function exchangeCode(doc, { code, redirectUri: ru, verifier, clientId, clientSecret }) {
    let res, body
    try {
      ;({ res, body } = await getJson(doc.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: basicAuthHeader(clientId, clientSecret),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: ru,
          code_verifier: verifier,
        }).toString(),
      }))
    } catch (e) {
      throw new KosmyError('unreachable', `token endpoint: ${e.message}`)
    }
    if (!res.ok || typeof body?.id_token !== 'string') {
      throw new KosmyError('exchange', `token endpoint refused the code: ${body?.error || res.status}`)
    }
    return body.id_token
  }

  /** The whole check: RS256 signature (jwks_uri), iss, aud, exp, iat, nonce, sub. */
  async function verifyIdToken(idToken, { issuer, doc, clientId, nonce }) {
    const parts = String(idToken).split('.')
    if (parts.length !== 3) throw new KosmyError('token', 'malformed ID token')
    let header, payload
    try {
      header = b64urlJson(parts[0])
      payload = b64urlJson(parts[1])
    } catch {
      throw new KosmyError('token', 'malformed ID token')
    }
    // Pinned, never read from the token: "alg": "none" or HS256-with-the-public-key are the classics.
    if (header?.alg !== 'RS256') throw new KosmyError('token', 'unexpected ID token algorithm')
    const key = await keyFor(issuer, doc, header.kid)
    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], 'base64url'),
    )
    if (!ok) throw new KosmyError('token', 'invalid ID token signature')

    if (payload.iss !== issuer) throw new KosmyError('token', 'ID token: wrong issuer')
    const aud = payload.aud
    const audOk = Array.isArray(aud)
      ? aud.includes(clientId) && (aud.length === 1 || payload.azp === clientId)
      : aud === clientId
    if (!audOk) throw new KosmyError('token', 'ID token: wrong audience')
    const t = Math.floor(now() / 1000)
    if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < t) throw new KosmyError('token', 'ID token expired')
    if (typeof payload.iat !== 'number') throw new KosmyError('token', 'ID token: missing iat')
    if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > t) throw new KosmyError('token', 'ID token not yet valid')
    if (!safeEqual(payload.nonce, nonce)) throw new KosmyError('token', 'ID token: nonce mismatch')
    if (typeof payload.sub !== 'string' || !payload.sub) throw new KosmyError('token', 'ID token: missing sub')

    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
    return {
      sub: payload.sub,
      name: str(payload.name),
      email: str(payload.email),
      preferred_username: str(payload.preferred_username),
      locale: str(payload.locale),
    }
  }

  /**
   * The Board's admin token (`kosmy.board-admin.v1`, server/board-admin/): signed
   * with the same key as its ID tokens, so it is checked against the same cached
   * JWKS — and that is exactly why `typ` is checked too. Without it, any ID
   * token the Board ever issued for this client (they last minutes, and pass
   * through browsers) would open the admin API.
   *
   * What it does NOT check is what only the request knows — `htm`, `htu`, and
   * whether `jti` was seen: the caller does (server/board-admin/index.js).
   */
  async function verifyAdminToken(token, { issuer, doc, clientId }) {
    const parts = String(token).split('.')
    if (parts.length !== 3) throw new KosmyError('token', 'malformed admin token')
    let header, payload
    try {
      header = b64urlJson(parts[0])
      payload = b64urlJson(parts[1])
    } catch {
      throw new KosmyError('token', 'malformed admin token')
    }
    if (header?.alg !== 'RS256') throw new KosmyError('token', 'unexpected admin token algorithm')
    const key = await keyFor(issuer, doc, header.kid)
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))
    if (!ok) throw new KosmyError('token', 'invalid admin token signature')
    if (header.typ !== ADMIN_TOKEN_TYP) throw new KosmyError('token', 'not an admin token (typ)')
    if (!payload || typeof payload !== 'object') throw new KosmyError('token', 'malformed admin token')

    if (payload.iss !== issuer) throw new KosmyError('token', 'admin token: wrong issuer')
    const aud = payload.aud
    if (!(Array.isArray(aud) ? aud.includes(clientId) : aud === clientId)) throw new KosmyError('token', 'admin token: wrong audience')
    const t = Math.floor(now() / 1000)
    if (typeof payload.exp !== 'number' || payload.exp + ADMIN_CLOCK_SKEW_S < t) throw new KosmyError('token', 'admin token expired')
    if (typeof payload.iat !== 'number') throw new KosmyError('token', 'admin token: missing iat')
    // A 60-second token issued "two minutes ago" (or from the future) is not one the Board made for this request.
    if (payload.iat - ADMIN_CLOCK_SKEW_S > t || t - payload.iat > ADMIN_MAX_AGE_S + ADMIN_CLOCK_SKEW_S) {
      throw new KosmyError('token', 'admin token: iat out of range')
    }
    if (typeof payload.nbf === 'number' && payload.nbf - ADMIN_CLOCK_SKEW_S > t) throw new KosmyError('token', 'admin token not yet valid')
    for (const k of ['sub', 'jti', 'htm', 'htu']) {
      if (typeof payload[k] !== 'string' || !payload[k] || payload[k].length > 2048) throw new KosmyError('token', `admin token: missing ${k}`)
    }
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined)
    return { sub: payload.sub, jti: payload.jti, exp: payload.exp, htm: payload.htm, htu: payload.htu, name: str(payload.name) }
  }

  return { discover, authorizationUrl, exchangeCode, verifyIdToken, verifyAdminToken, clear: () => cache.clear() }
}

/* ---------- pending flows (state → verifier, nonce, target…) ---------- */

/**
 * Server-side, in memory, single use. The browser holds only the `state`, in an
 * HttpOnly cookie, so the return must come back to the browser that left — a
 * link with someone else's `code` and `state` opens nothing (login CSRF).
 * A restart forgets the pending flows: the person clicks again.
 */
export function createFlowStore({ ttlMs = FLOW_TTL_MS, now = () => Date.now() } = {}) {
  const flows = new Map()
  function prune() {
    const t = now()
    for (const [k, v] of flows) if (v.exp < t) flows.delete(k)
    // Bounded: the launch route is reachable without an account.
    while (flows.size >= MAX_PENDING_FLOWS) flows.delete(flows.keys().next().value)
  }
  return {
    create(flow) {
      prune()
      const state = randomToken(24)
      flows.set(state, { ...flow, exp: now() + ttlMs })
      return state
    },
    /** Removes it whatever happens next: a state is consumed by its first use. */
    take(state) {
      if (typeof state !== 'string' || !state) return null
      const f = flows.get(state)
      flows.delete(state)
      if (!f || f.exp < now()) return null
      return f
    },
    get size() {
      return flows.size
    },
  }
}

/* ---------- accounts: by `sub`, never by e-mail ---------- */

/** Sign-in: the account linked to this Kosmy Board identity, or whether one may be created. */
export function resolveAccount(users, claims, { autoCreate }) {
  const linked = users.find((u) => u.kosmySub && u.kosmySub === claims.sub)
  if (linked) return { user: linked }
  if (!autoCreate) return { error: 'not_linked' }
  return { create: true }
}

/** A username derived from the Board's display name or e-mail, made unique among `users`. */
export function deriveUsername(users, claims) {
  const fromEmail = String(claims.preferred_username || claims.email || '').split('@')[0]
  const clean = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]+/g, '')
      .slice(0, 24)
  let base = clean(claims.name) || clean(fromEmail)
  if (base.length < 3) base = 'kosmy-user'
  let username = base
  let n = 2
  while (users.some((u) => u.username === username)) username = `${base.slice(0, 21)}${n++}`
  return username
}

/**
 * A new account for an unknown `sub` (automatic creation, off by default).
 * Always a plain user, without a password: it signs in through the Board. The
 * e-mail is not stored — nothing in Mocky may come to rely on an unverified one.
 */
export function newKosmyUser(users, claims) {
  return {
    id: crypto.randomUUID(),
    username: deriveUsername(users, claims),
    email: null,
    role: 'user',
    dashySub: null,
    kosmySub: claims.sub,
    salt: null,
    hash: null,
    createdAt: Date.now(),
  }
}

/** "Relier à Kosmy Board": store `sub` on the signed-in account `userId`. Mutates `users`. */
export function linkAccount(users, userId, sub) {
  const user = users.find((u) => u.id === userId)
  if (!user) return { error: 'session' }
  const owner = users.find((u) => u.kosmySub && u.kosmySub === sub)
  if (owner && owner.id !== userId) return { error: 'already_linked' }
  if (user.kosmySub && user.kosmySub !== sub) return { error: 'other_linked' }
  user.kosmySub = sub
  return { user }
}

/* ---------- the routes ---------- */

/**
 * Everything the routes need from server/index.js, passed in rather than
 * imported: the user and config stores, sessions and the auth guards live there.
 */
export function createKosmyBoardRoutes(deps) {
  const {
    loadConfig,
    saveConfig,
    loadUsers,
    saveUsers,
    sessionUser,
    setSession,
    requireUser,
    requireAdmin,
    verifyPw,
    accountLocked,
    noteAuthFailure,
    clearAuthFailures,
    logAuth,
    audit,
    auditActor,
    clientIp,
    authRateLimit,
    publicUser,
    assignNewcomerPlan,
    isMaintenance,
    isHttps,
    baseUrl,
    originSet = () => true,
    oidc = createOidcClient(),
    flows = createFlowStore(),
  } = deps

  const router = express.Router()

  const flowCookie = (req) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    path: '/auth/kosmy-board',
  })

  /** Back to the app, with a code the page turns into a sentence. */
  function backWithError(res, base, mode, code) {
    const u = new URL('/', base)
    u.searchParams.set('kosmy', mode === 'link' ? 'link-error' : 'error')
    u.searchParams.set('reason', code)
    res.redirect(303, u.href)
  }

  /** state + nonce + PKCE, kept server-side; the browser gets the state in a cookie. */
  async function start(req, res, settings, { mode, target, uid }) {
    const base = baseUrl(req)
    const doc = await oidc.discover(settings.issuer)
    const verifier = randomToken(32)
    const nonce = randomToken(16)
    const state = flows.create({ verifier, nonce, iss: settings.issuer, target, mode, uid })
    res.cookie(FLOW_COOKIE, state, { ...flowCookie(req), maxAge: FLOW_TTL_MS })
    return oidc.authorizationUrl(doc, {
      clientId: settings.clientId,
      redirectUri: redirectUri(base),
      state,
      nonce,
      verifier,
    })
  }

  // ---- launch: the login page's button, or the Board's "Ouvrir" ----
  router.get(LOGIN_PATH, authRateLimit(30, 60_000, 'kosmy-login'), async (req, res) => {
    const base = baseUrl(req)
    const settings = settingsOf(loadConfig())
    if (!settings.ready) return backWithError(res, base, 'login', 'not_configured')
    // Third-party initiated login (OpenID Connect Core §4): refuse another issuer.
    const iss = typeof req.query.iss === 'string' ? req.query.iss : null
    if (iss !== null && normalizeIssuer(iss) !== settings.issuer) return backWithError(res, base, 'login', 'issuer')
    const target = safeTarget(typeof req.query.target_link_uri === 'string' ? req.query.target_link_uri : null, base)
    try {
      res.redirect(303, await start(req, res, settings, { mode: 'login', target }))
    } catch (e) {
      console.error('mocky: kosmy-board launch failed —', e.message)
      backWithError(res, base, 'login', e instanceof KosmyError ? e.code : 'unreachable')
    }
  })

  // ---- "Relier à Kosmy Board", from Settings (signed in with a password) ----
  router.post('/api/account/kosmy-board/link', requireUser, authRateLimit(10, 60_000, 'kosmy-link'), async (req, res) => {
    const settings = settingsOf(loadConfig())
    if (!settings.ready) return res.status(400).json({ code: 'not_configured', error: 'Kosmy Board is not configured.' })
    try {
      const url = await start(req, res, settings, { mode: 'link', target: '/', uid: req.user.id })
      res.json({ url })
    } catch (e) {
      console.error('mocky: kosmy-board link start failed —', e.message)
      res.status(502).json({ code: e instanceof KosmyError ? e.code : 'unreachable', error: 'Kosmy Board is unreachable.' })
    }
  })

  // ---- unlinking needs the account's password ----
  router.post('/api/account/kosmy-board/unlink', requireUser, authRateLimit(8, 60_000, 'kosmy-unlink'), (req, res) => {
    const users = loadUsers()
    const user = users.find((u) => u.id === req.user.id)
    if (!user) return res.status(401).json({ error: 'Not signed in.' })
    if (!user.kosmySub) return res.json({ user: publicUser(user) })
    // Without a password the link is the only way in: removing it would lock the account out.
    if (!user.salt || !user.hash) return res.status(400).json({ code: 'no_password', error: 'This account has no password.' })
    if (accountLocked(user.username)) {
      return res.status(429).json({ code: 'locked', error: 'Too many failed attempts on this account.' })
    }
    if (!verifyPw(user, String(req.body?.password || ''))) {
      noteAuthFailure(user.username)
      logAuth('failure', req, user.username)
      return res.status(401).json({ code: 'password', error: 'Wrong password.' })
    }
    clearAuthFailures(user.username)
    delete user.kosmySub
    saveUsers(users)
    audit.record({ action: 'account.kosmy-unlink', actor: auditActor(user), ip: clientIp(req) })
    res.json({ user: publicUser(user) })
  })

  // ---- return from the Board ----
  router.get(CALLBACK_PATH, authRateLimit(30, 60_000, 'kosmy-callback'), async (req, res) => {
    const base = baseUrl(req)
    const q = req.query
    const state = typeof q.state === 'string' ? q.state : ''
    // Single use: the cookie is cleared and the flow taken whatever happens next.
    const cookieState = req.cookies?.[FLOW_COOKIE]
    res.clearCookie(FLOW_COOKIE, flowCookie(req))
    const flow = safeEqual(cookieState, state) ? flows.take(state) : null
    if (!flow) return backWithError(res, base, 'login', 'expired')
    const mode = flow.mode

    if (typeof q.error === 'string' && q.error) {
      return backWithError(res, base, mode, q.error === 'access_denied' ? 'denied' : 'failed')
    }
    const settings = settingsOf(loadConfig())
    if (!settings.ready) return backWithError(res, base, mode, 'not_configured')
    // The settings changed while the person was at the Board.
    if (flow.iss !== settings.issuer) return backWithError(res, base, mode, 'issuer')

    try {
      const doc = await oidc.discover(settings.issuer)
      // RFC 9207: the answer must come from the expected issuer (the Board always sends it).
      if (typeof q.iss === 'string' && q.iss !== doc.issuer) return backWithError(res, base, mode, 'issuer')
      const code = typeof q.code === 'string' ? q.code : ''
      if (!code) return backWithError(res, base, mode, 'failed')

      const idToken = await oidc.exchangeCode(doc, {
        code,
        redirectUri: redirectUri(base),
        verifier: flow.verifier,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
      })
      const claims = await oidc.verifyIdToken(idToken, {
        issuer: doc.issuer,
        doc,
        clientId: settings.clientId,
        nonce: flow.nonce,
      })

      if (mode === 'link') {
        // The account to link is the one that started the flow, still signed in here.
        const current = sessionUser(req)
        if (!current || current.id !== flow.uid) return backWithError(res, base, 'link', 'session')
        const users = loadUsers()
        const out = linkAccount(users, current.id, claims.sub)
        if (out.error) return backWithError(res, base, 'link', out.error)
        saveUsers(users)
        audit.record({ action: 'account.kosmy-link', actor: auditActor(out.user), ip: clientIp(req) })
        const u = new URL('/', base)
        u.searchParams.set('kosmy', 'linked')
        return res.redirect(303, u.href)
      }

      const users = loadUsers()
      const found = resolveAccount(users, claims, { autoCreate: settings.autoCreate })
      if (found.error) return backWithError(res, base, 'login', found.error)
      let user = found.user
      if (found.create) {
        // Signing in is allowed during maintenance; creating an account is a write,
        // and this GET is invisible to the method rule — the same guard as Dashy's.
        if (isMaintenance()) return backWithError(res, base, 'login', 'maintenance')
        user = assignNewcomerPlan(newKosmyUser(users, claims))
        users.push(user)
        saveUsers(users)
      }
      logAuth('success', req, user.username)
      audit.record({
        action: 'auth.kosmy-board',
        actor: auditActor(user),
        detail: { created: Boolean(found.create) },
        ip: clientIp(req),
      })
      setSession(res, user.id, req)
      res.redirect(303, new URL(flow.target || '/', base).href)
    } catch (e) {
      console.error('mocky: kosmy-board callback failed —', e.message)
      backWithError(res, base, mode, e instanceof KosmyError ? e.code : 'unreachable')
    }
  })

  // ---- Admin → Users → Kosmy Board ----
  router.get('/api/admin/kosmy-board', requireAdmin, (req, res) => {
    res.json(adminView(loadConfig(), baseUrl(req), { originSet: originSet() }))
  })

  router.put('/api/admin/kosmy-board', requireAdmin, (req, res) => {
    const cfg = loadConfig()
    const out = mergeSettings(cfg.kosmyBoard, req.body || {})
    if (out.error) return res.status(400).json({ code: out.error, error: 'Invalid issuer address.' })
    cfg.kosmyBoard = out.next
    saveConfig(cfg)
    oidc.clear()
    if (out.changed.length) {
      audit.record({
        action: 'config.kosmyBoard',
        actor: auditActor(req.user),
        detail: { fields: out.changed },
        ip: clientIp(req),
      })
    }
    res.json(adminView(cfg, baseUrl(req), { originSet: originSet() }))
  })

  /** Turn it off: the settings and the secret are forgotten. Linked accounts keep their `sub`. */
  router.delete('/api/admin/kosmy-board', requireAdmin, (req, res) => {
    const cfg = loadConfig()
    delete cfg.kosmyBoard
    saveConfig(cfg)
    oidc.clear()
    audit.record({ action: 'config.kosmyBoard', actor: auditActor(req.user), detail: { fields: ['removed'] }, ip: clientIp(req) })
    res.json(adminView(cfg, baseUrl(req), { originSet: originSet() }))
  })

  return router
}
