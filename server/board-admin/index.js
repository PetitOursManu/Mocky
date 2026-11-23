// "Admin dans le Board": Mocky's admin, administered from Kosmy Board.
//
// The protocol is Kosmy Board's `docs/admin-api.md` (kosmy.board-admin.v1):
//
//   GET  /api/kosmy-board/admin             the menu: the app and its sections
//   GET  /api/kosmy-board/admin/{section}   one section, as blocks
//   POST /api/kosmy-board/admin/{section}   one action in that section
//
// The Board's SERVER calls these, never a browser, with a 60-second JWT signed
// by the Board's OpenID Connect key — so this rides on "Sign in with Kosmy
// Board" (server/kosmy-board.js): the same settings, the same discovery and
// JWKS cache, the same `sub` → account link. Without that set up, every call
// answers 401.
//
// The Board says WHO the person is and nothing more. Rights are Mocky's: the
// linked account must be an administrator HERE, checked on every request, and
// every action goes through the function Admin's own route uses (sections.js).
//
// Mounted in server/index.js BEFORE maintenance and before `express.json` on
// /api: no session, no cookie, no CORS, no redirect, no SPA fallback — and an
// administrator's action passes maintenance anyway, which is the rule
// maintenance applies to administrators everywhere. Presence is not touched
// (`sessionUser`, not `currentUser`, D5): the Board reading a section is not
// somebody working in Mocky.

import express from 'express'
import { KosmyError, settingsOf } from '../kosmy-board.js'
import { BoardAdminError, createSections } from './sections.js'
import { langOf, translator } from './texts.js'

export const BOARD_ADMIN_PATH = '/api/kosmy-board/admin'
export const BOARD_ADMIN_PROTOCOL = 'kosmy.board-admin.v1'

/** The whole path, a section's included: `{section}` is `[a-z0-9-]{1,40}`. */
const PATH = /^\/api\/kosmy-board\/admin(?:\/([a-z0-9-]{1,40}))?$/

/** What the audit line of an action made from the Board says about where it came from. */
const VIA = { via: 'kosmy-board' }

/**
 * Every `jti` seen, until its token would have expired anyway (plus the clock
 * tolerance): a token serves one request. In memory — a restart forgets them,
 * and a token older than the restart is at most 90 seconds from dead. Only a
 * token whose signature held is ever recorded, so the map is bounded by what
 * the Board itself issues.
 */
export function createJtiStore({ now = () => Date.now(), skewMs = 30_000 } = {}) {
  const seen = new Map()
  return {
    /** True the first time, false for a replay. */
    use(jti, expSeconds) {
      const t = now()
      for (const [k, until] of seen) if (until < t) seen.delete(k)
      if (seen.has(jti)) return false
      seen.set(jti, (Number(expSeconds) || 0) * 1000 + skewMs)
      return true
    },
    get size() {
      return seen.size
    },
  }
}

/**
 * The Board's token, for one request — shared by the admin API and the users API
 * (kosmy.board-users.v1, ./users.js), which uses the same token on its own paths.
 * `jtis` is ONE store for both: a token is spent wherever it was spent.
 *
 * @param {{ loadConfig: () => object, loadUsers: () => object[], oidc: object }} d
 * @param {ReturnType<typeof createJtiStore>} jtis
 * @returns {(req, path: string, t: Function) => Promise<{ user: object, base: string, sub: string }>}
 */
export function createBoardAuth(d, jtis) {
  /**
   * The order of docs/admin-api.md: signature (the sign-in JWKS), typ, iss, aud,
   * exp — in `oidc.verifyAdminToken` — then htm, htu, jti, and last the account.
   * Every refusal of the token itself is the same 401: which check failed is
   * written to the log for the administrator, not handed to the caller.
   */
  return async function authenticate(req, path, t) {
    const settings = settingsOf(d.loadConfig())
    if (!settings.ready) throw new BoardAdminError(401, 'invalid_token', t('err.notConfigured'))
    const m = /^Bearer[ ]+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(String(req.headers.authorization || ''))
    if (!m) throw new BoardAdminError(401, 'invalid_token', t('err.token'))
    let claims
    try {
      const doc = await d.oidc.discover(settings.issuer)
      claims = await d.oidc.verifyAdminToken(m[1], { issuer: doc.issuer, doc, clientId: settings.clientId })
    } catch (e) {
      console.warn(`mocky: kosmy-board admin token refused — ${e instanceof KosmyError ? e.message : 'verification failed'}`)
      throw new BoardAdminError(401, 'invalid_token', t('err.token'))
    }
    // Bound to ONE request: its method, and the path it was made for. The Board
    // may reach Mocky through a proxy that adds a prefix, hence "ends with".
    let htuPath = null
    try {
      htuPath = new URL(claims.htu).pathname
    } catch {
      /* refused just below */
    }
    if (claims.htm !== req.method || !htuPath || !htuPath.endsWith(path)) {
      console.warn('mocky: kosmy-board admin token refused — htm/htu do not match the request')
      throw new BoardAdminError(401, 'invalid_token', t('err.token'))
    }
    if (!jtis.use(claims.jti, claims.exp)) {
      console.warn('mocky: kosmy-board admin token refused — jti already used')
      throw new BoardAdminError(401, 'invalid_token', t('err.token'))
    }
    // By `sub` only, never by e-mail — the rule of server/kosmy-board.js.
    const user = d.loadUsers().find((u) => u.kosmySub && u.kosmySub === claims.sub)
    if (!user) throw new BoardAdminError(403, 'not_linked', t('err.notLinked'))
    if ((user.role || 'user') !== 'admin') throw new BoardAdminError(403, 'forbidden', t('err.forbidden'))
    // Access withdrawn from the Board (server/board-admin/users.js): an
    // administrator's rights go with it, here as everywhere else.
    if (user.disabled) throw new BoardAdminError(403, 'forbidden', t('err.forbidden'))
    // The instance's address as the Board knows it: `htu` minus the path asked for.
    const htu = claims.htu.split(/[?#]/)[0]
    return { user, sub: claims.sub, base: htu.slice(0, htu.length - path.length) }
  }
}

/**
 * @param {object} d
 * @param {() => object} d.loadConfig
 * @param {() => object[]} d.loadUsers       the raw accounts: `kosmySub` and `role` are read here
 * @param {ReturnType<import('../kosmy-board.js').createOidcClient>} d.oidc   the one sign-in uses
 * @param {(req) => string|null} d.clientIp
 * Plus everything `createSections` reads — see the call in server/index.js.
 */
export function createBoardAdmin(d) {
  const jtis = d.jtis || createJtiStore()
  const authenticate = createBoardAuth(d, jtis)
  const sections = createSections(d)
  const parseJson = express.json({ limit: '1mb', type: () => true })

  function json(res, status, body) {
    res.status(status)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  async function serve(req, res) {
    const lang = langOf(req)
    const t = translator(lang)
    const path = String(req.originalUrl || req.url || '').split('?')[0]
    try {
      const { user: me, base } = await authenticate(req, path, t)
      const match = PATH.exec(path)
      if (!match) throw new BoardAdminError(404, 'not_found', t('err.notFound'))
      const ctx = { t, lang, me, base, by: { user: me, ip: d.clientIp(req), detail: VIA } }
      const id = match[1]

      if (!id) {
        if (req.method !== 'GET') throw new BoardAdminError(405, 'method_not_allowed', t('err.method'))
        return json(res, 200, {
          protocol: BOARD_ADMIN_PROTOCOL,
          app: { name: 'Mocky', version: d.version() },
          user: { name: me.username, role: t('role.admin') },
          sections: sections.list(ctx),
        })
      }
      if (!sections.has(id)) throw new BoardAdminError(404, 'not_found', t('err.notFound'))
      if (req.method === 'GET') return json(res, 200, sections.get(id, ctx))
      if (req.method !== 'POST') throw new BoardAdminError(405, 'method_not_allowed', t('err.method'))

      // Read only once the caller is known: a stranger's body is never parsed.
      await new Promise((resolve, reject) => parseJson(req, res, (err) => (err ? reject(err) : resolve())))
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
      const result = await sections.act(id, body, ctx)
      json(res, 200, { ok: true, ...result, section: sections.get(id, ctx) })
    } catch (e) {
      if (e instanceof BoardAdminError) {
        return json(res, e.status, { error: e.code, ...(e.userMessage ? { message: e.userMessage } : {}) })
      }
      // express.json's own refusals: a body that does not parse, or is too big.
      if (e && typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
        return json(res, e.status, { error: 'invalid_request', message: t('err.body') })
      }
      console.error('mocky: kosmy-board admin failed —', e?.message || e)
      if (!res.headersSent) json(res, 500, { error: 'server_error', message: t('err.failed') })
    }
  }

  return {
    /** Express middleware for `app.use(BOARD_ADMIN_PATH, …)`. Never calls `next`: nothing below may answer these paths. */
    handle(req, res) {
      serve(req, res).catch(() => {
        if (!res.headersSent) json(res, 500, { error: 'server_error' })
      })
    },
    jtis,
  }
}
