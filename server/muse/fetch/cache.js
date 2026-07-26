// Text-only distillation cache (M2/M7). Keyed by URL, 7-day TTL. Stores ONLY
// strings (the distilled/extracted text) — never raw HTML or images, never a
// third-party binary. Backed by a single JSON file under server/data, written
// atomically (temp + rename) like the rest of Mocky's store — no database, no
// native deps.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export class MuseCache {
  /**
   * @param {string} filePath  JSON file to persist to
   * @param {object} [opts]
   * @param {number} [opts.ttlMs]  entry lifetime (default 7 days)
   * @param {()=>number} [opts.now]  clock (injectable)
   */
  constructor(filePath, opts = {}) {
    this.filePath = filePath
    this.ttlMs = opts.ttlMs ?? SEVEN_DAYS_MS
    this.now = opts.now || (() => Date.now())
    /** @type {Record<string, {t:number, v:string}>} */
    this.map = this._load()
  }

  _load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  _persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      const tmp = `${this.filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.map))
      fs.renameSync(tmp, this.filePath)
    } catch {
      // A cache that can't persist is still a valid in-memory cache — never throw.
    }
  }

  _expired(entry) {
    return !entry || this.now() - entry.t > this.ttlMs
  }

  /** Return the cached text for `key`, or null if absent/expired. */
  get(key) {
    const entry = this.map[key]
    if (this._expired(entry)) {
      if (entry) {
        delete this.map[key]
        this._persist()
      }
      return null
    }
    return entry.v
  }

  /** Store text (strings only). */
  set(key, value) {
    if (typeof value !== 'string') {
      throw new TypeError('MuseCache only stores text (distillations), never binary or objects')
    }
    this.map[key] = { t: this.now(), v: value }
    this._persist()
  }

  /** Drop all expired entries; returns how many were removed. */
  prune() {
    let removed = 0
    for (const [k, entry] of Object.entries(this.map)) {
      if (this._expired(entry)) {
        delete this.map[k]
        removed++
      }
    }
    if (removed) this._persist()
    return removed
  }
}
