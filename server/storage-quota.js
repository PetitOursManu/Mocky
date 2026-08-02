// A ceiling on how much disk the media libraries may take.
//
// There was none. `POST /api/videos/upload` accepts 200 MB a time at 20 a
// minute, each clip kept as-is plus up to 150 extracted frames — roughly 4 GB a
// minute, from one ordinary account. On a private instance that is a foot-gun;
// on one reachable from the web it is a button anyone with an account can hold
// down.
//
// What makes it worse than "the disk fills up" is what happens next: every
// store swallows its own write errors (`_persist()` in the image, video and
// cache modules), so once the volume is full, accounts, sessions and projects
// simply stop being saved — silently, with the API still answering 200.
//
// The total is tracked in memory rather than measured per request: walking a
// library of thousands of files on every upload would cost more than the upload.
// It is seeded once at boot and adjusted on each write and delete. A drift of a
// few megabytes after a crash is irrelevant against a multi-gigabyte ceiling,
// and a restart re-seeds it exactly.

import fs from 'node:fs'
import path from 'node:path'

/** Default ceiling. Well above any real use — see the note on 0 below. */
export const DEFAULT_MAX_MB = 10 * 1024

/**
 * Read the configured ceiling in bytes.
 *
 * `MOCKY_MAX_STORAGE_MB=0` means no limit, for someone who would rather watch
 * their own disk. It has to be an explicit opt-out: "unlimited by default" is
 * how the problem above existed in the first place.
 */
export function maxBytesFromEnv(env = process.env) {
  const raw = env.MOCKY_MAX_STORAGE_MB
  if (raw == null || raw === '') return DEFAULT_MAX_MB * 1024 * 1024
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_MB * 1024 * 1024
  return Math.round(n) * 1024 * 1024 // 0 → unlimited
}

/** Total size of the files under `dir`, recursively. Missing dir → 0. */
export function dirSize(dir) {
  let total = 0
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    try {
      if (e.isDirectory()) total += dirSize(p)
      else if (e.isFile()) total += fs.statSync(p).size
    } catch {
      // A file that vanished mid-walk is not an error worth failing a boot for.
    }
  }
  return total
}

/**
 * @param {object} opts
 * @param {string[]} opts.dirs      directories whose contents count against the cap
 * @param {number} [opts.maxBytes]  0 = unlimited
 */
export function createDiskBudget({ dirs, maxBytes = maxBytesFromEnv() } = {}) {
  let used = 0
  let seeded = false

  return {
    /** Walk the directories once. Cheap enough at boot, never on a request. */
    seed() {
      used = dirs.reduce((sum, d) => sum + dirSize(d), 0)
      seeded = true
      return used
    },

    /** True when writing `bytes` more would cross the ceiling. */
    wouldExceed(bytes) {
      if (!maxBytes) return false
      if (!seeded) this.seed()
      return used + Math.max(0, Number(bytes) || 0) > maxBytes
    },

    add(bytes) {
      used += Math.max(0, Number(bytes) || 0)
    },

    /** Never let deletions drive the total negative — that would grant credit. */
    remove(bytes) {
      used = Math.max(0, used - Math.max(0, Number(bytes) || 0))
    },

    usage() {
      if (!seeded) this.seed()
      return {
        bytes: used,
        maxBytes,
        /** null when unlimited, so a caller cannot divide by zero. */
        ratio: maxBytes ? used / maxBytes : null,
      }
    },
  }
}

/**
 * Human byte size, in the unit that makes the number readable.
 *
 * Fixing on GB printed "0.0 GB of 0.0 GB" for anything under a gigabyte — a
 * message that tells the reader nothing and looks like a bug in itself. Small
 * ceilings are exactly the ones a self-hoster sets by hand.
 */
export function formatBytes(n) {
  const b = Math.max(0, Number(n) || 0)
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (b >= 1024 * 1024) return `${Math.round(b / (1024 * 1024))} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} kB`
  return `${b} B`
}

/** The message a user sees when the instance is full. Says what to do. */
export function quotaError(usage) {
  return (
    `This instance has reached its storage limit (${formatBytes(usage.bytes)} of ${formatBytes(usage.maxBytes)}). ` +
    'Delete some images or scroll sequences from the Media tab, or ask the administrator to raise ' +
    'MOCKY_MAX_STORAGE_MB.'
  )
}
