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

/**
 * Who may put a 3D block in a film — and why this one default is NOT the closed
 * one, in a file whose header says the defaults are the most closed available.
 *
 * The rule that header states is about a feature nothing on the instance has
 * agreed to yet. This is not that: it is a NARROWING of a permission that is
 * already closed one level up. `videoThreeDEnabledFor` asks `videoEnabledFor`
 * first, so "all" here does not mean every account on the instance — it means
 * every account an administrator already put on Motion's own list, or an
 * instance where they deliberately opened Motion to everyone. A second closed
 * default would be the same door locked twice, and the second lock is the one
 * nobody knows about.
 *
 * Three more reasons, and the third is the one that decided it.
 *
 * The cost is a surcharge, not a new bill. A render already spends about 4.3 s
 * of real time per second of film; a lit solid adds about 0.9 s/s, inside the
 * 1.7 s/s the duration-scaled deadline leaves spare (see
 * `tests/video-render-budget.test.js`). That is a fifth more of something
 * already being paid for — and it is bounded by the layout rather than by an
 * honour system, because a set piece in a crowded stack does not get expensive,
 * it gets small.
 *
 * `solidScene` shipped, and it is on. A default of `allowlist` with an empty
 * list would be an upgrade that silently deletes a block from every instance
 * that already renders films with it. The first symptom is a compose prompt that
 * has quietly stopped offering it, which reads as a regression rather than as a
 * policy, and nobody connects it to a setting they have never seen.
 *
 * And the accounting rule is untouched, which is what made the closed default
 * unnecessary rather than merely inconvenient: renders still appear against a
 * name, because the list that names people is the one above this.
 *
 * An administrator who is short of CPU switches this to 'allowlist' and the
 * empty list means nobody, exactly as it does for Motion itself.
 */
export const DEFAULT_THREE_D_ACCESS = 'all'

/**
 * Where the worker answers in the topology this repository ships.
 *
 * A default rather than an empty field, because the value is not the
 * administrator's to invent: `docker-compose.yml` names the service
 * `video-worker` and sets `PORT: 3030` on an internal bridge with no published
 * port, so this address is the only one that can ever work for the standard
 * deployment. Leaving it blank made a mandatory field out of a constant we
 * control, and the first thing an admin met was a question with one right
 * answer written down somewhere else.
 *
 * It is still editable: whoever runs the worker elsewhere — another host, a
 * published port, a different compose project — overwrites it, and clearing it
 * back to empty turns the feature off with an honest "not configured".
 */
export const DEFAULT_WORKER_URL = 'http://video-worker:3030'

export function defaultVideoConfig() {
  return {
    enabled: false,
    licenseKey: null,
    access: 'allowlist',
    allowedUserIds: [],
    // The 3D permission follows the template above rather than inventing one:
    // the same two modes, the same "a list is replaced, never merged", the same
    // absence of anything secret. Only the default differs, and
    // DEFAULT_THREE_D_ACCESS argues that.
    threeDAccess: DEFAULT_THREE_D_ACCESS,
    threeDAllowedUserIds: [],
    workerUrl: DEFAULT_WORKER_URL,
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
/**
 * Empty falls back to the shipped address rather than to nothing.
 *
 * A default applied only in `defaultVideoConfig()` reaches a fresh install and
 * nobody else: an instance that saved this config once already has a file with
 * `workerUrl: null` in it, and the merge dutifully keeps the null — so the
 * administrator who most needed the value still had to go and find it. Resolving
 * the fallback HERE reaches both.
 *
 * Nothing is lost by dropping the empty-means-off behaviour, because it was a
 * second off-switch for a feature that already has one: `enabled` is the master
 * switch, and it is the one the panel puts first. An address that turns the
 * feature off by being wrong is a worse control than a checkbox that says so.
 */
function mergeWorkerUrl(next, prev) {
  if (next === undefined) return prev || DEFAULT_WORKER_URL
  const s = next === null ? '' : str(next)
  if (s === '') return DEFAULT_WORKER_URL
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return prev || DEFAULT_WORKER_URL
    return s
  } catch {
    return prev || DEFAULT_WORKER_URL
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
    threeDAccess: ACCESS_MODES.includes(p.threeDAccess) ? p.threeDAccess : base.threeDAccess,
    threeDAllowedUserIds: mergeAllowedUserIds(p.threeDAllowedUserIds, base.threeDAllowedUserIds),
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
    // Same shape as the pair above, and for the same reason: this projection is
    // what the panel edits, so a field the panel cannot see is a setting an
    // administrator cannot change. Nothing here is secret — a list of account
    // ids is what the panel already draws checkboxes from — and the one thing
    // that IS secret stays a boolean two lines up.
    threeDAccess: ACCESS_MODES.includes(c.threeDAccess) ? c.threeDAccess : DEFAULT_THREE_D_ACCESS,
    threeDAllowedUserIds: Array.isArray(c.threeDAllowedUserIds) ? [...c.threeDAllowedUserIds] : [],
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

/**
 * May this account put a 3D block in a film?
 *
 * **It asks `videoEnabledFor` first, and that is the load-bearing line.** A 3D
 * permission granted to an account that cannot export at all is a right to
 * nothing, and reading the two lists independently is how an instance ends up
 * with a "yes" nobody can act on and an admin debugging the wrong checkbox. It
 * also means the two rules the list above earned are inherited rather than
 * re-argued: the master switch closes this too, and an administrator is still
 * not allowed on their role alone.
 *
 * That inheritance is why the default here is 'all' — see
 * DEFAULT_THREE_D_ACCESS. The narrowing exists for the instance whose worker is
 * short of CPU, not for the one that has not decided yet.
 *
 * The check is on the DOCUMENT everywhere it is used, never on the interface: a
 * 3D block reaches the worker through `POST /render`, which a client can call
 * without ever opening the panel that would have hidden the button.
 */
export function videoThreeDEnabledFor(cfg, user) {
  if (!videoEnabledFor(cfg, user)) return false
  const c = { ...defaultVideoConfig(), ...(cfg || {}) }
  if (c.threeDAccess === 'all') return true
  const id = typeof user?.id === 'string' ? user.id.trim() : ''
  if (!id) return false
  return Array.isArray(c.threeDAllowedUserIds) && c.threeDAllowedUserIds.includes(id)
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

  threeDEnabledFor(user) {
    return videoThreeDEnabledFor(this.config, user)
  }
}
