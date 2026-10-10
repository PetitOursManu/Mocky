// Who did what to the instance: sign-ins, accounts, settings, maintenance.
//
// The one store of the dashboard that is WRITTEN, because it answers a question
// asked after the fact — "who turned sign-ups back on", "when was this account
// deleted", "how many failed sign-ins last night" — and a restart must not
// erase the answer. The auth lines on stdout already said some of it, but only
// to whoever kept the container's logs, and never to the Admin screen.
//
// JSON Lines, appended, because an audit trail is written far more often than
// it is read, and rewriting a 2,000-entry JSON array to add one line is the
// wrong way round. A crash mid-append leaves at most one torn last line, which
// the reader skips. The file is compacted — rewritten atomically, like every
// other store here — once it holds twice what is kept.
//
// What an entry never holds: a password, a key, a token, a prompt, the VALUE of
// a setting. A configuration change records which FIELDS changed, so "the image
// provider key was replaced" is visible and the key is not. `cleanDetail` is
// where that is enforced, and it runs on every entry whoever wrote the call.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** The closed list of what gets recorded. The panel keys its labels on these. */
export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login-failed',
  'auth.locked',
  'auth.register',
  'auth.sso',
  'account.password',
  'user.create',
  'user.delete',
  'user.password-reset',
  'user.signout',
  'user.plan',
  'account.testPlan',
  'session.revoke',
  'config.registration',
  'config.freePlan',
  'config.text',
  'config.images',
  'config.video',
  'maintenance.on',
  'maintenance.off',
  'maintenance.message',
  'announcement.set',
  'announcement.clear',
  'migration.code',
  'migration.revoke',
  'migration.finalize',
  'mcp.config',
  'mcp.connect',
  'mcp.revoke',
  'mcp.token-reuse',
]

const ACTIONS = new Set(AUDIT_ACTIONS)

/** A detail key that smells of a secret is dropped, whatever its value. */
const SECRET_KEY = /pass|secret|token|cookie|auth|apikey|api_key|credential|license|licence/i

function cleanText(v, max = 120) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Keep only flat, short, non-secret facts: numbers, booleans, short strings and
 * short lists of short strings (a list of changed field NAMES). Anything nested
 * is dropped rather than walked — a nested object is how a whole config body,
 * key included, would arrive here by accident.
 */
export function cleanDetail(detail) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const out = {}
  for (const [k, v] of Object.entries(detail).slice(0, 12)) {
    if (SECRET_KEY.test(k)) continue
    const key = cleanText(k, 32)
    if (!key) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
    else if (typeof v === 'boolean') out[key] = v
    else if (typeof v === 'string') out[key] = cleanText(v)
    else if (Array.isArray(v)) {
      const items = v.filter((x) => typeof x === 'string').slice(0, 20).map((x) => cleanText(x, 48))
      if (items.length) out[key] = items
    }
  }
  return Object.keys(out).length ? out : null
}

function cleanParty(p) {
  if (!p || typeof p !== 'object') return null
  const id = p.id ? cleanText(p.id, 64) : null
  const name = p.name ? cleanText(p.name, 64) : null
  return id || name ? { id, name } : null
}

export function createAuditLog({ dataDir, file = 'audit.jsonl', max = 2000, now = Date.now } = {}) {
  const full = path.join(dataDir, file)
  /** Newest last, at most `max` — what the panel reads, without touching disk. */
  let entries = []
  let lines = 0

  try {
    const raw = fs.readFileSync(full, 'utf8').split('\n').filter(Boolean)
    lines = raw.length
    for (const l of raw.slice(-max)) {
      try {
        const e = JSON.parse(l)
        if (e && ACTIONS.has(e.action) && typeof e.at === 'number') entries.push(e)
      } catch {
        /* a torn line from a crash mid-append — skipped, never fatal */
      }
    }
  } catch {
    /* no log yet */
  }

  function compact() {
    const tmp = `${full}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 })
    fs.renameSync(tmp, full)
    lines = entries.length
  }

  return {
    /**
     * Never throws. An audit line that cannot be written must not turn a
     * successful sign-in or a saved setting into an error — it is reported on
     * stderr, where the auth lines already are.
     */
    record({ action, actor = null, target = null, detail = null, ip = null }) {
      if (!ACTIONS.has(action)) return null
      const entry = {
        id: `${now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        at: now(),
        action,
        actor: cleanParty(actor),
        target: cleanParty(target),
        detail: cleanDetail(detail),
        ip: ip ? cleanText(ip, 64) : null,
      }
      entries.push(entry)
      if (entries.length > max) entries = entries.slice(-max)
      try {
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.appendFileSync(full, JSON.stringify(entry) + '\n', { mode: 0o600 })
        lines++
        if (lines > max * 2) compact()
      } catch (err) {
        console.error(`mocky: could not write the audit log — ${err?.message || err}`)
      }
      return entry
    },

    /**
     * Newest first. `before` is an entry id to page from; `group` filters on
     * the part before the dot ('auth', 'user', 'config'…).
     */
    list({ limit = 200, before = null, group = null } = {}) {
      let list = entries
      if (group) list = list.filter((e) => e.action.split('.')[0] === group)
      if (before) {
        const i = list.findIndex((e) => e.id === before)
        if (i >= 0) list = list.slice(0, i)
      }
      const n = Math.max(1, Math.min(500, Number(limit) || 200))
      return list.slice(-n).reverse()
    },

    /** Failed sign-ins in the last `ms` — the overview's security line. */
    countSince(action, ms) {
      const floor = now() - ms
      let n = 0
      for (let i = entries.length - 1; i >= 0 && entries[i].at >= floor; i--) if (entries[i].action === action) n++
      return n
    },
  }
}
