// Admin-configurable video-export settings, persisted as JSON under server/data
// (same "no database, no native deps" store as the rest of Mocky).
//
// Modelled on server/images/config.js, including the secret discipline: the
// Remotion licence key is stored here but NEVER returned to the browser —
// `publicView()` replaces it with `hasLicenseKey`. Updates are partial, so
// omitting the key (or sending "") keeps the stored value and an admin never
// has to retype it; sending `null` clears it.
//
// The defaults are deliberately the most closed ones available. Export is off,
// and access is by allowlist rather than to everyone, because the worker is a
// separate opt-in Docker service under the `video-export` profile: an instance
// that has not built it gains nothing from the feature being on, and one that
// has is spending real CPU per render.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** Who may export. 'allowlist' is the default; see `enabledFor`. */
export const ACCESS_MODES = ['all', 'allowlist']

export function defaultVideoConfig() {
  return {
    enabled: false,
    licenseKey: null,
    access: 'allowlist',
    allowedUserIds: [],
    workerUrl: null,
  }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. Same rule as the image keys. */
const secret = (next, prev) => {
  if (next === null) return null
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

/**
 * An optional non-secret URL: '' clears as well as null, because an admin who
 * empties the field in the panel means "no worker", and there is no default to
 * fall back to.
 *
 * A value that is not http(s) is refused and the previous one kept. This URL is
 * one the SERVER will fetch, so it joins the short list of admin-configured
 * bypasses of the SSRF guard; a typo stored silently would surface much later as
 * an unexplained failure in the queue, at which point nobody looks at this file.
 */
function mergeWorkerUrl(next, prev) {
  if (next === undefined) return prev ?? null
  if (next === null) return null
  const s = str(next)
  if (s === '') return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return prev ?? null
    return s
  } catch {
    return prev ?? null
  }
}

/**
 * The allowlist is REPLACED by a patch that carries one, never merged: the panel
 * edits a list, so a merge would make removing an account impossible — the only
 * way to express a removal is to send the list without it.
 *
 * Empty strings are filtered out here, and `enabledFor` refuses an empty id as
 * well. One of the two guards is redundant on purpose: a config file edited by
 * hand does not go through this function, and `[''].includes(user?.id ?? '')` is
 * a very quiet way to grant access to everyone unauthenticated.
 */
function mergeAllowedUserIds(next, prev) {
  if (!Array.isArray(next)) return Array.isArray(prev) ? prev : []
  const seen = new Set()
  for (const raw of next) {
    const id = str(raw)
    if (id) seen.add(id)
  }
  return [...seen]
}

/** Apply a partial update. Unknown values keep whatever was there before. */
export function mergeVideoConfig(current, patch) {
  const base = { ...defaultVideoConfig(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : Boolean(base.enabled),
    licenseKey: secret(p.licenseKey, base.licenseKey ?? null),
    access: ACCESS_MODES.includes(p.access) ? p.access : base.access,
    allowedUserIds: mergeAllowedUserIds(p.allowedUserIds, base.allowedUserIds),
    workerUrl: mergeWorkerUrl(p.workerUrl, base.workerUrl),
  }
}

/** Browser-safe projection: the licence key becomes a boolean, like every other secret. */
export function publicVideoConfig(cfg) {
  const c = { ...defaultVideoConfig(), ...(cfg || {}) }
  return {
    accessModes: ACCESS_MODES,
    enabled: Boolean(c.enabled),
    hasLicenseKey: Boolean(c.licenseKey),
    access: ACCESS_MODES.includes(c.access) ? c.access : 'allowlist',
    allowedUserIds: Array.isArray(c.allowedUserIds) ? [...c.allowedUserIds] : [],
    workerUrl: c.workerUrl || null,
  }
}

/**
 * May this account export a video?
 *
 * An administrator is NOT automatically allowed. It is tempting — an admin can
 * grant themselves the right in one click anyway — but that click is the point:
 * the allowlist is what the per-account usage report counts, and a role that
 * grants access implicitly makes renders appear against nobody's name. An admin
 * who wants the feature adds themselves to the list, and the count stays honest.
 * That is M8's accounting rule applied to CPU instead of bytes.
 */
export function videoEnabledFor(cfg, user) {
  const c = { ...defaultVideoConfig(), ...(cfg || {}) }
  if (!c.enabled) return false
  if (c.access === 'all') return true
  const id = typeof user?.id === 'string' ? user.id.trim() : ''
  if (!id) return false
  return Array.isArray(c.allowedUserIds) && c.allowedUserIds.includes(id)
}

export class VideoConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'video-config.json')
    this.config = this._load()
  }

  _load() {
    try {
      return mergeVideoConfig(defaultVideoConfig(), JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return defaultVideoConfig()
    }
  }

  /** Atomic write of the whole config. Never throws — see `update`. */
  _write() {
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      // 0600: this file holds the Remotion licence key in clear text.
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      // Config that can't persist is still applied in memory — never throw.
      // But log it: a read-only volume used to look exactly like success.
      this.lastPersistError = err.message
      console.error(`mocky: could not save video config to ${this.file} — ${err.message}`)
    }
  }

  get() {
    return this.config
  }

  publicView() {
    return publicVideoConfig(this.config)
  }

  /** Merge a partial update, persist atomically, return the new config. */
  update(patch) {
    this.config = mergeVideoConfig(this.config, patch)
    this._write()
    return this.config
  }

  enabledFor(user) {
    return videoEnabledFor(this.config, user)
  }
}
