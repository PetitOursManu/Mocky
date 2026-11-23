// "Les utilisateurs gérés par le Board": Mocky's accounts, given and taken from
// Kosmy Board.
//
// The protocol is Kosmy Board's `docs/users-api.md` (kosmy.board-users.v1):
//
//   GET    /api/kosmy-board/users          what Mocky offers (roles, restrictions) + the linked accounts
//   PUT    /api/kosmy-board/users/{sub}    create, link or update the account of Board person {sub}
//   DELETE /api/kosmy-board/users/{sub}    withdraw it: the account is DISABLED, never deleted
//
// The token is the admin API's (`kb-admin+jwt`, ./index.js `createBoardAuth`),
// with the same jti store: the Board says who acts, Mocky checks that this
// person is one of ITS administrators, still active, on every request. The
// `{sub}` in the address is only who the action is about — it grants nothing.
//
// What the Board can set is what Mocky already enforces per account, and
// nothing decorative:
//  - the role: `admin` or `user`, Mocky's only two;
//  - `plan` (users only): free or standard — server/plan.js, read off the
//    account by every gate (the free model, the daily limit, no paid pictures);
//  - `assistants`: on the list of who may connect an AI assistant (MCP). Only
//    offered while that list decides (`access.mode` is not 'all'): with the
//    door open to everyone, a "no" would be a checkbox that does nothing.
//
// `provision` also runs at sign-in, when the ID token carries
// `kosmy_board_access` (server/kosmy-board.js): same checks, no e-mail link.

import express from 'express'
import { PLANS, freePlanSettings, planOf } from '../plan.js'
import { cleanUsername, newKosmyUser } from '../kosmy-board.js'
import { BoardAdminError } from './sections.js'
import { createBoardAuth, createJtiStore } from './index.js'
import { langOf, translator } from './texts.js'

export const BOARD_USERS_PATH = '/api/kosmy-board/users'
export const BOARD_USERS_PROTOCOL = 'kosmy.board-users.v1'

/** The whole path; `{sub}` is the Board's account id, `[A-Za-z0-9-]{1,64}`. */
const PATH = /^\/api\/kosmy-board\/users(?:\/([^/]*))?$/
const SUB = /^[A-Za-z0-9-]{1,64}$/
/** The protocol's ceiling on the accounts listed. */
const MAX_USERS = 500
const ROLES = ['admin', 'user']
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/

const VIA = { via: 'kosmy-board' }

const isAdmin = (u) => (u?.role || 'user') === 'admin'
const activeAdmins = (users) => users.filter((u) => isAdmin(u) && !u.disabled)
const cleanEmail = (v) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return EMAIL.test(e) ? e : null
}
const cleanName = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null)

/**
 * @param {object} d
 * @param {() => object} d.loadConfig
 * @param {() => object[]} d.loadUsers
 * @param {(users: object[]) => void} d.saveUsers
 * @param {object} d.oidc                     sign-in's OpenID Connect client (JWKS cache)
 * @param {ReturnType<typeof createJtiStore>} [d.jtis]   the admin API's store: one token, one use
 * @param {(user: object) => object} d.assignNewcomerPlan
 * @param {(userId: string) => number} d.revokeSessions
 * @param {(userId: string) => void} d.forgetPresence
 * @param {() => { listed: boolean, userIds: string[] }} d.mcpAccess
 * @param {(userId: string, allowed: boolean, by: object) => void} d.setMcpAccess   throws when it cannot save
 * @param {(userId: string) => void} d.mcpDisabled        revoke the account's assistant connections and keys
 * @param {() => boolean} d.isMaintenance
 * @param {object} d.audit
 * @param {(u: object) => object} d.auditActor
 * @param {(req) => string|null} d.clientIp
 */
export function createBoardUsers(d) {
  const jtis = d.jtis || createJtiStore()
  const authenticate = createBoardAuth(d, jtis)
  const parseJson = express.json({ limit: '100kb', type: () => true })

  function json(res, status, body) {
    res.status(status)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  /* ---------- what Mocky offers ---------- */

  function roles(t) {
    return [
      { value: 'admin', label: t('role.admin'), description: t('bu.role.admin'), admin: true },
      { value: 'user', label: t('role.user'), description: t('bu.role.user') },
    ]
  }

  function fields(t, cfg = d.loadConfig()) {
    const { newAccounts, dailyLimit } = freePlanSettings(cfg)
    const out = [
      {
        name: 'plan',
        label: t('bu.field.plan'),
        type: 'select',
        value: newAccounts,
        options: [
          { value: 'standard', label: t('plan.standard') },
          { value: 'free', label: t('plan.free') },
        ],
        help: dailyLimit ? t('bu.field.planHelp', { n: dailyLimit }) : t('bu.field.planHelpUnlimited'),
        // An administrator is always standard (server/plan.js): for them the field would do nothing.
        roles: ['user'],
      },
    ]
    if (d.mcpAccess().listed) {
      out.push({ name: 'assistants', label: t('bu.field.assistants'), type: 'checkbox', value: false, help: t('bu.field.assistantsHelp') })
    }
    return out
  }

  /** The values as Mocky applies them now — what the Board shows as the real state. */
  function valuesOf(user, mcp = d.mcpAccess()) {
    const v = {}
    if (!isAdmin(user)) v.plan = planOf(user)
    if (mcp.listed) v.assistants = mcp.userIds.includes(user.id)
    return v
  }

  /**
   * Every value the Board sent, checked as if it came from a stranger. Only the
   * fields Mocky offers right now are read; anything else is ignored. A field the
   * role does not have (`plan` for an administrator) is ignored too.
   */
  function cleanValues(raw, role, t) {
    if (raw === undefined || raw === null) return {}
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new BoardAdminError(422, 'invalid', t('bu.err.values'))
    const out = {}
    if (role !== 'admin' && 'plan' in raw) {
      if (!PLANS.includes(raw.plan)) throw new BoardAdminError(422, 'invalid', t('bu.err.plan'))
      out.plan = raw.plan
    }
    if (d.mcpAccess().listed && 'assistants' in raw) {
      if (typeof raw.assistants !== 'boolean') throw new BoardAdminError(422, 'invalid', t('bu.err.assistants'))
      out.assistants = raw.assistants
    }
    return out
  }

  /* ---------- create, link or update ---------- */

  /**
   * The account of Board person `sub`, with the role and restrictions in `body`.
   * `me` is the sub of who acts and `actor` their Mocky account (both null at
   * sign-in, where the person acts for themselves); `atLogin` forbids the e-mail
   * link — at sign-in nobody vouches for the address, a PUT is one of Mocky's
   * administrators acting. Throws a BoardAdminError; nothing is written then.
   *
   * @returns {{ status: 'created'|'linked'|'updated', user: object }}
   */
  function provision(sub, body, { me = null, actor = null, atLogin = false, t, ip = null }) {
    const role = body?.role
    if (!ROLES.includes(role)) throw new BoardAdminError(422, 'invalid', t('bu.err.role'))
    const values = cleanValues(body?.values, role, t)
    const name = cleanName(body?.name)
    const email = cleanEmail(body?.email)

    const users = d.loadUsers()
    let user = users.find((u) => u.kosmySub && u.kosmySub === sub)
    let status = 'updated'
    // An address is one person's: never on two accounts linked to two different
    // Board accounts. Checked on update too, or a rename in the Board would
    // quietly give two accounts the same e-mail.
    if (email && users.some((u) => u.kosmySub && u.kosmySub !== sub && String(u.email || '').toLowerCase() === email)) {
      throw new BoardAdminError(409, 'conflict', t('bu.err.emailTaken'))
    }
    if (!user && !atLogin && email) {
      const same = users.filter((u) => !u.kosmySub && String(u.email || '').toLowerCase() === email)
      if (same.length > 1) throw new BoardAdminError(409, 'conflict', t('bu.err.emailAmbiguous'))
      if (same.length === 1) {
        user = same[0]
        status = 'linked'
      }
    }

    const losesAdmin = Boolean(user) && isAdmin(user) && !user.disabled && role !== 'admin'
    if (losesAdmin && me && sub === me) throw new BoardAdminError(409, 'conflict', t('bu.err.selfAdmin'))
    if (losesAdmin && activeAdmins(users).length <= 1) throw new BoardAdminError(409, 'conflict', t('bu.err.lastAdmin'))

    const before = user ? { role: user.role || 'user', plan: planOf(user), disabled: Boolean(user.disabled) } : null
    if (!user) {
      // Without a password: this account signs in through the Board, nowhere else.
      user = newKosmyUser(users, { sub, name: name || undefined, email: email || undefined })
      if (role === 'user' && !values.plan) d.assignNewcomerPlan(user)
      users.push(user)
      status = 'created'
    } else {
      user.kosmySub = sub
      // The name the Board shows becomes the username — only for an account that
      // has nothing else to sign in with (no password, no Dashy, which renames on
      // its own sign-in). Kept when the name is taken: the same PUT twice must
      // leave the same account (idempotent), never `alice2`, `alice3`…
      const wanted = name ? cleanUsername(name) : ''
      if (!user.salt && !user.hash && !user.dashySub && wanted.length >= 3 && wanted !== user.username) {
        if (!users.some((u) => u !== user && u.username === wanted)) user.username = wanted
      }
    }
    if (email) user.email = email
    user.role = role
    if (role !== 'admin') delete user.testPlan
    if (values.plan === 'free') user.plan = 'free'
    else if (values.plan === 'standard') delete user.plan
    // A PUT is the Board saying "this person has access": it reactivates.
    delete user.disabled
    delete user.disabledAt
    d.saveUsers(users)

    if ('assistants' in values && d.mcpAccess().userIds.includes(user.id) !== values.assistants) {
      try {
        d.setMcpAccess(user.id, values.assistants, { user: actor || user, ip, detail: VIA })
      } catch (e) {
        console.error('mocky: kosmy-board users — could not save the assistants list —', e?.message || e)
        throw new BoardAdminError(500, 'server_error', t('bu.err.save'))
      }
    }

    const changed = !before || before.role !== role || before.plan !== planOf(user) || before.disabled
    if (changed || status !== 'updated') {
      d.audit.record({
        action: 'user.provision',
        actor: d.auditActor(actor || user),
        target: d.auditActor(user),
        detail: { status, role, plan: planOf(user), reactivated: Boolean(before?.disabled), atLogin, ...VIA },
        ip,
      })
    }
    return { status, user }
  }

  /**
   * Sign-in with `kosmy_board_access` (server/kosmy-board.js): applies the claim
   * as a PUT without the e-mail link. Answers the reason code the login page
   * knows how to say, never throws.
   */
  function provisionAtLogin(claims, req) {
    const t = translator('fr')
    const access = claims.access || {}
    const users = d.loadUsers()
    const existing = users.find((u) => u.kosmySub && u.kosmySub === claims.sub)
    // Maintenance is read-only (server/maintenance.js), and this GET is invisible
    // to its method rule: no account is created, and an existing one signs in as
    // it stands — the Board's values are applied at the next sign-in or PUT.
    if (d.isMaintenance()) {
      if (!existing) return { error: 'maintenance' }
      if (existing.disabled) return { error: 'disabled' }
      return { user: existing, status: 'updated' }
    }
    try {
      return provision(
        claims.sub,
        { name: claims.name, email: claims.email, role: access.role, values: access.values },
        { atLogin: true, t, ip: d.clientIp(req) },
      )
    } catch (e) {
      if (!(e instanceof BoardAdminError)) throw e
      console.warn(`mocky: kosmy-board sign-in — the access in the ID token was refused (${e.userMessage || e.code})`)
      return { error: 'access' }
    }
  }

  /* ---------- withdraw ---------- */

  function disable(sub, { me, actor, t, ip }) {
    const users = d.loadUsers()
    const user = users.find((u) => u.kosmySub && u.kosmySub === sub)
    // Nothing linked, or already withdrawn: nothing to do, and the Board is told so.
    if (!user || user.disabled) return { ok: true }
    if (sub === me) throw new BoardAdminError(409, 'conflict', t('bu.err.selfDisable'))
    if (isAdmin(user) && activeAdmins(users).length <= 1) throw new BoardAdminError(409, 'conflict', t('bu.err.lastAdmin'))
    user.disabled = true
    user.disabledAt = Date.now()
    d.saveUsers(users)
    // Signed out everywhere at once — the sessions, the presence, the assistants
    // it let in (OAuth connections and keys). Its projects stay: a PUT gives
    // the account back as it was.
    const sessions = d.revokeSessions(user.id)
    d.forgetPresence(user.id)
    d.mcpDisabled(user.id)
    d.audit.record({
      action: 'user.disable',
      actor: d.auditActor(actor),
      target: d.auditActor(user),
      detail: { sessions, ...VIA },
      ip,
    })
    return { ok: true, message: t('bu.disabled', { name: user.username }) }
  }

  /* ---------- the routes ---------- */

  async function serve(req, res) {
    const lang = langOf(req)
    const t = translator(lang)
    const path = String(req.originalUrl || req.url || '').split('?')[0]
    try {
      const { sub: me, user: actor } = await authenticate(req, path, t)
      const ip = d.clientIp(req)
      const match = PATH.exec(path)
      if (!match) throw new BoardAdminError(404, 'not_found', t('err.notFound'))
      const target = match[1]

      if (target === undefined) {
        if (req.method !== 'GET') throw new BoardAdminError(405, 'method_not_allowed', t('err.method'))
        const cfg = d.loadConfig()
        const mcp = d.mcpAccess()
        return json(res, 200, {
          protocol: BOARD_USERS_PROTOCOL,
          roles: roles(t),
          defaultRole: 'user',
          fields: fields(t, cfg),
          users: d
            .loadUsers()
            .filter((u) => u.kosmySub && SUB.test(u.kosmySub))
            .slice(0, MAX_USERS)
            .map((u) => ({
              sub: u.kosmySub,
              role: isAdmin(u) ? 'admin' : 'user',
              values: valuesOf(u, mcp),
              active: !u.disabled,
              account: u.username,
            })),
        })
      }
      if (!SUB.test(target)) throw new BoardAdminError(404, 'not_found', t('err.notFound'))

      if (req.method === 'PUT') {
        // Read only once the caller is known: a stranger's body is never parsed.
        await new Promise((resolve, reject) => parseJson(req, res, (err) => (err ? reject(err) : resolve())))
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
        const out = provision(target, body, { me, actor, t, ip })
        return json(res, 200, { ok: true, status: out.status, account: out.user.username, message: t(`bu.${out.status}`, { name: out.user.username }) })
      }
      if (req.method === 'DELETE') return json(res, 200, disable(target, { me, actor, t, ip }))
      throw new BoardAdminError(405, 'method_not_allowed', t('err.method'))
    } catch (e) {
      if (e instanceof BoardAdminError) {
        return json(res, e.status, { error: e.code, ...(e.userMessage ? { message: e.userMessage } : {}) })
      }
      if (e && typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
        return json(res, e.status, { error: 'invalid_request', message: t('err.body') })
      }
      console.error('mocky: kosmy-board users failed —', e?.message || e)
      if (!res.headersSent) json(res, 500, { error: 'server_error', message: t('err.failed') })
    }
  }

  return {
    /** Express middleware for `app.use(BOARD_USERS_PATH, …)`. Never calls `next`. */
    handle(req, res) {
      serve(req, res).catch(() => {
        if (!res.headersSent) json(res, 500, { error: 'server_error' })
      })
    },
    provision,
    provisionAtLogin,
    jtis,
  }
}
