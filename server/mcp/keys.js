/**
 * Assistant keys — `mcp-keys.json` (invariant X8).
 *
 * A fixed bearer credential for an assistant that does not go through OAuth:
 * one configured by hand, an assistant like Claude, a script. It acts
 * as ONE account, at one of two levels (levels.js, X9), on `/mcp` and nowhere
 * else.
 *
 *   mocky_ak_<lookup>_<secret>
 *            12 hex   43 base64url = 32 random bytes (256 bits)
 *
 * The prefix is how a person, a log scanner or a secret scanner recognises one,
 * and how routes.js tells it from an OAuth token (always 43 characters, never
 * this prefix) without changing anything on the OAuth path.
 *
 * Kept like a token (X3): only the SHA-256 of the whole key reaches the disk,
 * with its `lookup` to find it. A 256-bit random secret needs no slow hash —
 * nobody can enumerate it — and the comparison is in constant time, against a
 * dummy hash when the lookup is unknown, so an unknown key and a wrong secret
 * cost the same. The key itself exists once, in the answer to its creation; it
 * is never stored, listed, logged or audited, and neither is its lookup: the
 * interface addresses a key by an `id` of its own.
 *
 * A key is the account's own: it is created by the account, from its session,
 * with its password (routes.js). An administrator allows the feature, sees the
 * keys without their value and revokes them — never creates one for somebody.
 *
 * Does not travel with a migration (server/migration/manifest.js), for the
 * reason `mcp-oauth.json` does not: it is a credential for one server.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { hashToken } from './oauth-store.js'
import { KEY_LEVELS, levelOf } from './levels.js'

export const KEY_PREFIX = 'mocky_ak_'
export const KEY_RE = /^mocky_ak_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/
export const KEY_LENGTH = KEY_PREFIX.length + 12 + 1 + 43
export const MAX_KEYS_PER_ACCOUNT = 5
export const MAX_KEYS = 1000
export const KEY_NAME_MAX = 60
/** The lifetimes a key may be given; `null` (no expiry) is the other choice. */
export const KEY_EXPIRY_DAYS = Object.freeze([7, 30, 90, 365])
/** How long an expired key stays on the list, marked expired, before it is forgotten. */
export const EXPIRED_KEPT_MS = 30 * 24 * 60 * 60 * 1000
/** How often "last used" may reach the disk — every call would be a write per call. */
const TOUCH_PERSIST_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** A refusal the route turns into a status: name, level, expiry, limit, full. */
export class KeyError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

/** Whether a bearer value is meant to be a key — the prefix alone, to choose the path. */
export const isKeyToken = (t) => typeof t === 'string' && t.startsWith(KEY_PREFIX)

/** The lookup of a well-formed key, or null. Says nothing about whether it exists. */
export function parseKey(t) {
  if (typeof t !== 'string' || t.length !== KEY_LENGTH) return null
  const m = KEY_RE.exec(t)
  return m ? { lookup: m[1] } : null
}

export function mintKey() {
  const lookup = crypto.randomBytes(6).toString('hex')
  const secret = crypto.randomBytes(32).toString('base64url')
  return { token: `${KEY_PREFIX}${lookup}_${secret}`, lookup }
}

export const hashKey = (t) => hashToken(t)

/** What an unknown lookup is compared against, so it costs what a known one costs. */
const DUMMY_HASH = hashKey(`${KEY_PREFIX}${'0'.repeat(12)}_${'A'.repeat(43)}`)

/**
 * A key's name: one line, 1 to 60 characters. Null otherwise — and null for
 * anything that looks like a key, because a name is shown and audited, and a
 * key pasted into the wrong field would be both.
 */
export function cleanKeyName(v) {
  if (typeof v !== 'string') return null
  const s = v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s || s.length > KEY_NAME_MAX || s.includes(KEY_PREFIX)) return null
  return s
}

const isHex = (v, n) => typeof v === 'string' && v.length === n && /^[0-9a-f]+$/.test(v)
const isTime = (v) => typeof v === 'number' && Number.isFinite(v)

export function createKeyStore(dataDir, { now = () => Date.now() } = {}) {
  const file = path.join(dataDir, 'mcp-keys.json')
  /**
   * id → record. A Map, never a plain object: an id comes from a URL
   * (`DELETE /api/admin/mcp/keys/:id`), and `{}`['constructor'] is a function —
   * `get('constructor')` once answered a view of it, and the admin route
   * "revoked" it with a 200 and an audit line for a key that never existed.
   */
  const keys = load()
  /** lookup → id, rebuilt from the records. */
  const byLookup = new Map()
  for (const rec of keys.values()) byLookup.set(rec.lookup, rec.id)
  let saveTimer = null

  function load() {
    const out = new Map()
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      const own = raw && typeof raw === 'object' && Object.hasOwn(raw, 'keys') ? raw.keys : null
      const stored = own && typeof own === 'object' && !Array.isArray(own) ? own : {}
      // Own entries only, and each one filed under its own id: a record that is
      // not exactly what create() writes is not a key.
      for (const [slot, rec] of Object.entries(stored)) {
        if (!rec || typeof rec !== 'object' || rec.id !== slot) continue
        if (!isHex(rec.id, 32) || !isHex(rec.lookup, 12) || !isHex(rec.hash, 64)) continue
        if (typeof rec.userId !== 'string' || !rec.userId || !isTime(rec.createdAt)) continue
        out.set(rec.id, {
          id: rec.id,
          lookup: rec.lookup,
          hash: rec.hash,
          userId: rec.userId,
          name: typeof rec.name === 'string' ? rec.name.slice(0, KEY_NAME_MAX) : '',
          level: levelOf(rec.level),
          createdAt: rec.createdAt,
          lastUsedAt: isTime(rec.lastUsedAt) ? rec.lastUsedAt : null,
          expiresAt: isTime(rec.expiresAt) ? rec.expiresAt : null,
        })
      }
    } catch {
      out.clear()
    }
    return out
  }

  /** The record behind an id, or undefined — only an id this store holds, never an inherited name. */
  const recordOf = (id) => (typeof id === 'string' ? keys.get(id) : undefined)

  const expired = (rec, t = now()) => rec.expiresAt !== null && rec.expiresAt <= t

  function forget(id) {
    const rec = recordOf(id)
    if (!rec) return false
    byLookup.delete(rec.lookup)
    keys.delete(id)
    return true
  }

  /** An expired key stays visible a while, then goes. Returns whether anything went. */
  function prune() {
    const t = now()
    let gone = false
    for (const rec of [...keys.values()]) {
      if (rec.expiresAt !== null && rec.expiresAt + EXPIRED_KEPT_MS <= t) gone = forget(rec.id) || gone
    }
    return gone
  }

  function save() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    prune()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    // 0600: hashes are not keys, but the file still says who may act as whom.
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, keys: Object.fromEntries(keys) }), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function saveSoon() {
    if (!saveTimer) {
      // Nobody is waiting on this write: a full or read-only disk thrown from a
      // timer would stop the whole server, for a "last used" date.
      saveTimer = setTimeout(() => {
        try {
          save()
        } catch (err) {
          console.error(`mocky: could not save assistant keys — ${err?.code || 'error'}`)
        }
      }, TOUCH_PERSIST_MS)
      saveTimer.unref?.()
    }
  }

  /** What leaves this module about a key: a whitelist. Never the key, its hash or its lookup. */
  function view(rec) {
    return {
      id: rec.id,
      userId: rec.userId,
      name: rec.name,
      level: rec.level,
      createdAt: rec.createdAt,
      lastUsedAt: rec.lastUsedAt,
      expiresAt: rec.expiresAt,
      expired: expired(rec),
    }
  }

  function countFor(userId) {
    let n = 0
    for (const rec of keys.values()) if (rec.userId === userId) n++
    return n
  }

  /**
   * A new key. Returns the view and the key itself — the only time it exists
   * outside the hands of whoever asked. Throws KeyError.
   */
  function create({ userId, name, level, expiresInDays = null }) {
    if (typeof userId !== 'string' || !userId) throw new KeyError('user')
    const clean = cleanKeyName(name)
    if (!clean) throw new KeyError('name')
    // No default level: a missing one is a mistake, and the wrong default is `write`.
    if (!KEY_LEVELS.includes(level)) throw new KeyError('level')
    if (expiresInDays !== null && !KEY_EXPIRY_DAYS.includes(expiresInDays)) throw new KeyError('expiry')
    if (prune()) save()
    if (countFor(userId) >= MAX_KEYS_PER_ACCOUNT) throw new KeyError('limit')
    if (keys.size >= MAX_KEYS) throw new KeyError('full')

    let minted = mintKey()
    for (let i = 0; byLookup.has(minted.lookup); i++) {
      if (i > 8) throw new KeyError('full')
      minted = mintKey()
    }
    const t = now()
    const rec = {
      id: crypto.randomBytes(16).toString('hex'),
      lookup: minted.lookup,
      hash: hashKey(minted.token),
      userId,
      name: clean,
      level,
      createdAt: t,
      lastUsedAt: null,
      expiresAt: expiresInDays === null ? null : t + expiresInDays * DAY_MS,
    }
    keys.set(rec.id, rec)
    byLookup.set(rec.lookup, rec.id)
    save()
    return { key: view(rec), token: minted.token }
  }

  /**
   * The key behind a presented value, or null — unknown, wrong secret, revoked
   * and expired all answer null, after the same constant-time comparison.
   */
  function verify(token) {
    const parsed = parseKey(token)
    const id = parsed ? byLookup.get(parsed.lookup) : undefined
    const rec = recordOf(id)
    const presented = Buffer.from(hashKey(typeof token === 'string' ? token : ''), 'hex')
    const stored = Buffer.from(rec ? rec.hash : DUMMY_HASH, 'hex')
    const same = crypto.timingSafeEqual(presented, stored)
    if (!same || !rec || expired(rec)) return null
    return { id: rec.id, userId: rec.userId, name: rec.name, level: levelOf(rec.level), expiresAt: rec.expiresAt }
  }

  function list(userId) {
    if (prune()) save()
    return [...keys.values()]
      .filter((rec) => !userId || rec.userId === userId)
      .map(view)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function get(id) {
    const rec = recordOf(id)
    return rec ? view(rec) : null
  }

  function revoke(id) {
    if (!forget(id)) return false
    save()
    return true
  }

  /** Every key of one account, when it loses the right or the account. */
  function revokeUser(userId) {
    let n = 0
    for (const rec of [...keys.values()]) if (rec.userId === userId && forget(rec.id)) n++
    if (n) save()
    return n
  }

  /** Mark a key used. Persisted at most once a minute. */
  function touch(id) {
    const rec = recordOf(id)
    if (!rec) return
    rec.lastUsedAt = now()
    saveSoon()
  }

  /** For shutdown: write what `touch` was holding back. */
  function flush() {
    if (saveTimer) save()
  }

  return { create, verify, list, get, revoke, revokeUser, countFor, touch, flush }
}
