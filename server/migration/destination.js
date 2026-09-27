// The NEW server's side of a migration: it pulls, verifies, stages, and only
// then — on an explicit, password-confirmed request — swaps the staged copy in.
//
// Three properties, each the answer to a way a migration loses data:
//
//   Resumable.  Files land in `.migration/staging/` one chunk at a time, and a
//               file that is already there with the right hash is never fetched
//               again. A cut connection, a restart, a second pass: each costs
//               only what is missing.
//   Verified.   Every file is checked against the SHA-256 the source listed
//               before it counts as staged. The transport is already
//               authenticated (crypto.js); this catches a file that CHANGED
//               under the source between its manifest and its bytes.
//   Two-phase.  Nothing outside `.migration/` is touched until `finalize`, and
//               finalize refuses unless the last pass ran against a source in
//               maintenance with no render in flight — the only state in which
//               "everything was copied" is still true a second later.
//
// The key derived from the pairing code is held in memory only. After a restart
// the admin types the code again; the staged files and what is known about them
// survive, so the transfer resumes rather than restarts.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { deriveKeys, open, parsePairingCode, signRequest } from './crypto.js'
import { MIGRATION_DIR, hashFile, resolveInside, safeRelPath } from './manifest.js'

/** Parallel downloads. Small files dominate by count (a clip is 150 stills), so a few in flight matters. */
const CONCURRENCY = 3
const REQUEST_TIMEOUT_MS = 60_000
/**
 * The first manifest hashes the whole data directory on the source — gigabytes of
 * clips on a spinning disk — before it can answer. Later ones hit the hash cache.
 */
const MANIFEST_TIMEOUT_MS = 20 * 60_000
const RETRIES = 3

export class MigrationError extends Error {
  /** @param {string} code  a key the client translates: migration.error.<code> */
  constructor(code, detail) {
    super(detail || code)
    this.code = code
  }
}

/**
 * The address an admin typed, as a base URL — or a refusal.
 *
 * This is the FOURTH administrator-only bypass of the SSRF guard (see
 * docs/architecture/invariants.md). It exists for the reason the render worker's
 * does: moving between two machines on one LAN is the ordinary case for a
 * self-hosted tool, and the guard refuses every private address. What stays:
 * the scheme, no credentials in the URL, and `redirect: 'manual'` on every
 * request. And what a bypass would normally buy — reading an internal service —
 * it does not buy here: a response is only ever used if it opens under the
 * pairing key, so whatever else answers is discarded unread.
 */
export function parseSourceUrl(input) {
  let u
  try {
    u = new URL(String(input || '').trim())
  } catch {
    throw new MigrationError('url')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new MigrationError('url')
  if (u.username || u.password) throw new MigrationError('url')
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
}

function validEntry(e) {
  return (
    e &&
    typeof e === 'object' &&
    safeRelPath(e.path) === e.path &&
    Number.isSafeInteger(e.size) &&
    e.size >= 0 &&
    /^[0-9a-f]{64}$/.test(e.sha256 || '')
  )
}

/**
 * What the preflight compares against. The size lives in the manifest's
 * summary, not in its facts; the first version handed over the facts alone, so
 * the disk check needed zero bytes on every instance and could never block.
 */
function sourceFacts(manifest) {
  return { ...(manifest.facts || {}), summary: manifest.summary }
}

function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 })
  fs.renameSync(tmp, file)
}

/**
 * @param {object} opts
 * @param {string} opts.dataDir
 * @param {(ctx:{keys:object, manifest:object}) => Promise<object>} opts.localFacts
 * @param {(sourceFacts:object, localFacts:object) => object} opts.compare
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(event:string, detail:object) => void} [opts.log]
 */
export function createMigrationDestination({ dataDir, localFacts, compare, fetchImpl = fetch, log = () => {} }) {
  const root = path.resolve(dataDir)
  const workDir = path.join(root, MIGRATION_DIR)
  const stagingDir = path.join(workDir, 'staging')
  const stagedFile = path.join(workDir, 'staged.json')
  const reportFile = path.join(workDir, 'report.json')

  /** @type {null | {base:string, keys:object, manifest:object, preflight:object, connectedAt:number}} */
  let session = null
  let job = null
  let staged = readStaged()
  let stagedDirty = false

  function readStaged() {
    try {
      const obj = JSON.parse(fs.readFileSync(stagedFile, 'utf8'))
      return obj && typeof obj === 'object' ? obj : {}
    } catch {
      return {}
    }
  }
  function flushStaged(force = false) {
    if (!stagedDirty && !force) return
    fs.mkdirSync(workDir, { recursive: true })
    writeJsonAtomic(stagedFile, staged)
    stagedDirty = false
  }

  async function call(base, keys, rel, signal, timeoutMs = REQUEST_TIMEOUT_MS) {
    const { header, nonce } = signRequest(keys, 'GET', rel)
    let res
    try {
      res = await fetchImpl(`${base}${rel}`, {
        headers: { authorization: header, accept: 'application/octet-stream' },
        redirect: 'manual',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      if (signal?.aborted) throw new MigrationError('cancelled')
      throw new MigrationError('unreachable', err instanceof Error ? err.message : String(err))
    }
    if (res.status === 401) throw new MigrationError('refused')
    if (res.status === 404) throw new MigrationError('gone')
    if (!res.ok) throw new MigrationError('http', String(res.status))
    const body = Buffer.from(await res.arrayBuffer())
    try {
      return open(keys, rel, nonce, body)
    } catch {
      // Not sealed by this pairing for this request: the wrong host, a proxy
      // rewriting bodies, or tampering. Nothing of it is parsed.
      throw new MigrationError('unreadable')
    }
  }

  async function fetchManifest(base, keys, signal) {
    const plain = await call(base, keys, '/api/migration/manifest', signal, MANIFEST_TIMEOUT_MS)
    let m
    try {
      m = JSON.parse(plain.toString('utf8'))
    } catch {
      throw new MigrationError('unreadable')
    }
    if (m?.v !== 1 || !Array.isArray(m.files)) throw new MigrationError('unreadable')
    const bad = m.files.filter((e) => !validEntry(e))
    // A source that lists a path this side would refuse is not a source to
    // half-trust: the whole manifest goes.
    if (bad.length) throw new MigrationError('manifest', bad.slice(0, 3).map((e) => String(e?.path)).join(', '))
    return m
  }

  async function connect(url, code) {
    if (job?.running) throw new MigrationError('busy')
    const base = parseSourceUrl(url)
    const bytes = parsePairingCode(code)
    if (!bytes) throw new MigrationError('code')
    const keys = deriveKeys(bytes)
    const manifest = await fetchManifest(base, keys)
    const local = await localFacts({ keys, manifest })
    const preflight = compare(sourceFacts(manifest), local)
    session = { base, keys, manifest, preflight, connectedAt: Date.now() }
    log('connected', { base, files: manifest.files.length })
    return status()
  }

  function disconnect() {
    if (job?.running) job.abort.abort()
    session = null
  }

  function stagedPath(rel) {
    return resolveInside(stagingDir, rel)
  }

  async function downloadFile(entry, signal, progress) {
    const final = stagedPath(entry.path)
    if (!final) throw new MigrationError('manifest', entry.path)
    fs.mkdirSync(path.dirname(final), { recursive: true })

    // Already there from an earlier pass whose index was not flushed (a crash):
    // adopt it if the bytes are right rather than fetching them again.
    if (fs.existsSync(final)) {
      try {
        if (fs.statSync(final).size === entry.size && (await hashFile(final)) === entry.sha256) {
          staged[entry.path] = { size: entry.size, sha256: entry.sha256 }
          stagedDirty = true
          progress(entry.size)
          return
        }
      } catch {
        /* fetch it again */
      }
    }

    const part = `${final}.part`
    for (let attempt = 0; attempt < 2; attempt++) {
      let offset = 0
      try {
        const st = fs.statSync(part)
        offset = st.size <= entry.size ? st.size : 0
      } catch {
        offset = 0
      }
      if (offset === 0) fs.writeFileSync(part, Buffer.alloc(0), { mode: 0o600 })
      progress(offset)
      while (offset < entry.size) {
        const rel = `/api/migration/file?path=${encodeURIComponent(entry.path)}&offset=${offset}`
        let chunk
        for (let r = 0; ; r++) {
          try {
            chunk = await call(session.base, session.keys, rel, signal)
            break
          } catch (err) {
            const transient = err instanceof MigrationError && (err.code === 'unreachable' || err.code === 'http')
            if (!transient || r >= RETRIES - 1) throw err
            await new Promise((ok) => setTimeout(ok, 1000 * 2 ** r))
          }
        }
        if (chunk.length === 0) throw new MigrationError('changed', entry.path)
        fs.appendFileSync(part, chunk)
        offset += chunk.length
        progress(chunk.length)
      }
      if ((await hashFile(part)) === entry.sha256) {
        fs.renameSync(part, final)
        staged[entry.path] = { size: entry.size, sha256: entry.sha256 }
        stagedDirty = true
        return
      }
      // The file changed on the source between its manifest and its bytes. One
      // clean retry from zero; after that it is the next pass's business.
      fs.rmSync(part, { force: true })
      progress(-offset)
    }
    throw new MigrationError('changed', entry.path)
  }

  /** One pass: a fresh manifest, then whatever it lists that is not staged with the same hash. */
  async function runPass(state) {
    const manifest = await fetchManifest(session.base, session.keys, state.abort.signal)
    session.manifest = manifest
    session.preflight = compare(sourceFacts(manifest), await localFacts({ keys: session.keys, manifest }))
    if (session.preflight.blocking) throw new MigrationError('preflight')

    // Deleted on the source since an earlier pass: deleted here too, or the
    // swap would resurrect it.
    const listed = new Set(manifest.files.map((e) => e.path))
    for (const rel of Object.keys(staged)) {
      if (!listed.has(rel)) {
        const abs = stagedPath(rel)
        if (abs) fs.rmSync(abs, { force: true })
        delete staged[rel]
        stagedDirty = true
      }
    }

    const todo = manifest.files.filter((e) => staged[e.path]?.sha256 !== e.sha256)
    state.filesTotal = todo.length
    state.bytesTotal = todo.reduce((n, e) => n + e.size, 0)
    state.final = Boolean(manifest.facts?.maintenance) && !manifest.facts?.queue?.active

    let next = 0
    let lastFlush = Date.now()
    const worker = async () => {
      while (next < todo.length && !state.abort.signal.aborted) {
        const entry = todo[next++]
        state.current = entry.path
        try {
          await downloadFile(entry, state.abort.signal, (n) => (state.bytesDone += n))
        } catch (err) {
          if (state.abort.signal.aborted) return
          state.failed.push({ path: entry.path, code: err instanceof MigrationError ? err.code : 'io' })
        }
        state.filesDone++
        if (Date.now() - lastFlush > 5000) {
          flushStaged()
          lastFlush = Date.now()
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    flushStaged()
    if (state.abort.signal.aborted) throw new MigrationError('cancelled')
    state.current = null
  }

  function startPass() {
    if (!session) throw new MigrationError('not-connected')
    if (job?.running) throw new MigrationError('busy')
    const state = {
      running: true,
      startedAt: Date.now(),
      finishedAt: null,
      filesTotal: 0,
      filesDone: 0,
      bytesTotal: 0,
      bytesDone: 0,
      current: null,
      failed: [],
      final: false,
      error: null,
      abort: new AbortController(),
    }
    job = state
    runPass(state)
      .catch((err) => {
        state.error = err instanceof MigrationError ? err.code : 'io'
        if (!(err instanceof MigrationError)) console.error('mocky: migration pass failed —', err?.message || err)
      })
      .finally(() => {
        state.running = false
        state.finishedAt = Date.now()
        try {
          flushStaged()
        } catch {
          /* reported by the next pass */
        }
        log('pass', { files: state.filesDone, failed: state.failed.length, final: state.final, error: state.error })
      })
    return status()
  }

  function cancel() {
    if (job?.running) job.abort.abort()
  }

  /** Ready to swap: a finished, clean pass against a source that could not change under it. */
  function ready() {
    return Boolean(
      session &&
        job &&
        !job.running &&
        !job.error &&
        job.failed.length === 0 &&
        job.final &&
        session.manifest.files.every((e) => staged[e.path]?.sha256 === e.sha256),
    )
  }

  function readReport() {
    try {
      return JSON.parse(fs.readFileSync(reportFile, 'utf8'))
    } catch {
      return null
    }
  }

  /**
   * Swaps the staged copy in. The current contents of the data directory are
   * MOVED aside into `.migration/previous-<time>/`, never deleted: an import
   * that turns out wrong is undone by moving them back.
   *
   * Sessions are written empty — they were never transferred, and the ones this
   * server had belong to accounts that no longer exist. The caller restarts the
   * process afterwards, because every store that caches its file in memory (the
   * libraries, the queue, the provider configs) would otherwise keep serving
   * the instance that was just replaced.
   */
  function finalize() {
    if (!ready()) throw new MigrationError('not-ready')
    const manifest = session.manifest
    for (const e of manifest.files) {
      const abs = stagedPath(e.path)
      if (!abs || !fs.existsSync(abs) || fs.statSync(abs).size !== e.size) throw new MigrationError('staging', e.path)
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const previous = path.join(workDir, `previous-${stamp}`)
    fs.mkdirSync(previous, { recursive: true })
    const moved = []
    const placed = []
    try {
      for (const name of fs.readdirSync(root)) {
        if (name === MIGRATION_DIR) continue
        fs.renameSync(path.join(root, name), path.join(previous, name))
        moved.push(name)
      }
      for (const name of fs.readdirSync(stagingDir)) {
        fs.renameSync(path.join(stagingDir, name), path.join(root, name))
        placed.push(name)
      }
      fs.writeFileSync(path.join(root, 'sessions.json'), '{}', { mode: 0o600 })
    } catch (err) {
      // Put everything back the way it was. Best effort, and said so: a
      // half-swapped directory is the one outcome worse than a failed import.
      for (const name of placed) {
        try {
          fs.renameSync(path.join(root, name), path.join(stagingDir, name))
        } catch {
          /* reported below */
        }
      }
      for (const name of moved) {
        try {
          fs.renameSync(path.join(previous, name), path.join(root, name))
        } catch {
          /* reported below */
        }
      }
      console.error('mocky: migration swap failed and was rolled back —', err?.message || err)
      throw new MigrationError('swap', err instanceof Error ? err.message : String(err))
    }

    const report = {
      finishedAt: Date.now(),
      source: session.base,
      summary: manifest.summary,
      previous: path.basename(previous),
      // The list, with hashes, so "Vérifier" can re-hash the result after the
      // restart without the source still being there.
      files: manifest.files.map((e) => ({ path: e.path, size: e.size, sha256: e.sha256 })),
    }
    writeJsonAtomic(reportFile, report)
    staged = {}
    fs.rmSync(stagedFile, { force: true })
    fs.rmSync(stagingDir, { recursive: true, force: true })
    log('finalized', { source: session.base, files: manifest.files.length })
    session = null
    job = null
    return { ok: true, summary: report.summary }
  }

  /**
   * Re-hashes what the last import placed, after the fact. Answers "is what I
   * am running on byte-for-byte what the old server had?" — the files may since
   * have changed because the instance was used, and the result says which.
   */
  async function verifyImport() {
    const report = readReport()
    if (!report) throw new MigrationError('no-report')
    let same = 0
    const changed = []
    const missing = []
    for (const e of report.files) {
      const abs = resolveInside(root, e.path)
      if (!abs || !fs.existsSync(abs)) {
        missing.push(e.path)
        continue
      }
      if ((await hashFile(abs)) === e.sha256) same++
      else changed.push(e.path)
    }
    return { total: report.files.length, same, changed: changed.slice(0, 50), missing: missing.slice(0, 50), changedCount: changed.length, missingCount: missing.length }
  }

  function status() {
    const report = readReport()
    return {
      connected: Boolean(session),
      source: session?.base || null,
      summary: session?.manifest?.summary || null,
      preflight: session?.preflight || null,
      pass: job
        ? {
            running: job.running,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            filesTotal: job.filesTotal,
            filesDone: job.filesDone,
            bytesTotal: job.bytesTotal,
            bytesDone: job.bytesDone,
            current: job.current,
            failed: job.failed.slice(0, 20),
            failedCount: job.failed.length,
            final: job.final,
            error: job.error,
          }
        : null,
      staged: Object.keys(staged).length,
      ready: ready(),
      report: report ? { finishedAt: report.finishedAt, source: report.source, summary: report.summary, files: report.files.length } : null,
    }
  }

  return { connect, disconnect, startPass, cancel, finalize, verifyImport, status, ready }
}
