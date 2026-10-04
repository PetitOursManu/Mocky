// What a migration moves, and how a path from the other side is made safe.
//
// The data directory IS the instance (docs/deployment.md, "What lives in the
// volume"), so the list is "everything, minus what must not travel" rather than
// an enumeration of stores. An enumeration would be the wrong way round: the
// next store somebody adds would be silently left behind on the old server, and
// nobody would notice until the old server was gone.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** The directory a migration keeps its own state in, inside the data directory. */
export const MIGRATION_DIR = '.migration'

/**
 * Top-level files that never travel.
 *
 * `sessions.json` is the decision the user made: a session token is a bearer
 * credential, and one in transit is one more place it can leak from. Everyone
 * signs in again once on the new server. `sso-jti.json` is a replay cache for
 * 60-second tokens, worthless an hour later and harmful if stale.
 * `mcp-oauth.json` holds the assistants' tokens (by hash) and is a session store
 * by another name: each connected assistant asks for consent again once.
 */
export const EXCLUDED_FILES = new Set(['sessions.json', 'sso-jti.json', 'mcp-oauth.json'])

/**
 * One path segment. Deliberately narrow: whatever the source SAYS a file is
 * called becomes a path on the destination's disk, so a name is accepted only if
 * it could not mean anything but a name — no separator of either OS, no drive
 * colon, no NUL, nothing starting with a dot but our own `.migration`, which is
 * never listed anyway.
 */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._@+=,;-]{0,199}$/

/**
 * The relative path, if it is one a manifest may carry; null otherwise.
 * Both sides call it: the source so it never lists what the destination would
 * refuse, the destination because it never trusts what the source listed.
 */
export function safeRelPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) return null
  const parts = rel.split('/')
  if (parts.length > 8) return null
  for (const p of parts) {
    if (!SEGMENT.test(p) || p === '.' || p === '..') return null
  }
  return parts.join('/')
}

/**
 * The absolute path of `rel` inside `root`, or null if it would land anywhere
 * else. `safeRelPath` already makes escaping impossible; this is the second,
 * independent check, because a path check you have to reason about is one you
 * will eventually reason about wrongly.
 */
export function resolveInside(root, rel) {
  const safe = safeRelPath(rel)
  if (!safe) return null
  const base = path.resolve(root)
  const abs = path.resolve(base, ...safe.split('/'))
  return abs.startsWith(base + path.sep) ? abs : null
}

function isTransient(name) {
  return name.endsWith('.tmp') || name.endsWith('.part')
}

/**
 * Every file the migration carries, as `{ path, abs, size, mtimeMs }`.
 * Symlinks and anything that is not a regular file are skipped: following a
 * link out of the data directory is how "send me users.json" becomes "send me
 * /etc/shadow".
 */
export function listFiles(dataDir) {
  const root = path.resolve(dataDir)
  const out = []
  const skipped = []
  const walk = (dir, prefix, depth) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (!prefix && (e.name === MIGRATION_DIR || EXCLUDED_FILES.has(e.name))) continue
      if (isTransient(e.name)) continue
      if (!safeRelPath(rel)) {
        skipped.push(rel)
        continue
      }
      const abs = path.join(dir, e.name)
      if (e.isSymbolicLink()) {
        skipped.push(rel)
        continue
      }
      if (e.isDirectory()) {
        if (depth < 7) walk(abs, rel, depth + 1)
        continue
      }
      if (!e.isFile()) continue
      let st
      try {
        st = fs.lstatSync(abs)
      } catch {
        continue
      }
      if (!st.isFile()) continue
      out.push({ path: rel, abs, size: st.size, mtimeMs: Math.floor(st.mtimeMs) })
    }
  }
  walk(root, '', 0)
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { files: out, skipped }
}

/** SHA-256 of a file, streamed: a video library does not fit in memory. */
export function hashFile(abs) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(abs)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')))
  })
}

/**
 * Hashes keyed on (path, size, mtime). A first pass hashes gigabytes; the final
 * pass, under maintenance, must not — it is the pass that decides how long users
 * are locked out, so it pays only for what changed.
 */
export function createHashCache() {
  const cache = new Map()
  return function hashOf(file) {
    const hit = cache.get(file.path)
    if (hit && hit.size === file.size && hit.mtimeMs === file.mtimeMs) return hit.sha256
    // The promise is what is cached, so the warm-up started with the pairing
    // code and a manifest request arriving mid-way share one read of each file.
    const sha256 = hashFile(file.abs)
    cache.set(file.path, { size: file.size, mtimeMs: file.mtimeMs, sha256 })
    sha256.catch(() => cache.delete(file.path))
    return sha256
  }
}

/**
 * What the instance holds, in words an admin checks against: accounts,
 * projects, pictures, clips, films. Counted from the files that travel, so the
 * destination can recount after the import and compare like with like.
 */
export function summarize(dataDir, files) {
  const count = (re) => files.filter((f) => re.test(f.path)).length
  let users = 0
  try {
    const list = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))
    if (Array.isArray(list)) users = list.length
  } catch {
    /* no accounts yet */
  }
  return {
    users,
    projectFiles: count(/^data-[^/]+\.json$/),
    images: count(/^image-library\/[^/]+$/),
    clips: files.filter((f) => /^video-library\/[^/]+\//.test(f.path)).reduce((set, f) => set.add(f.path.split('/')[1]), new Set()).size,
    films: count(/^video-exports\/[^/]+$/),
    avatars: count(/^avatars\/[^/]+$/),
    files: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
  }
}
