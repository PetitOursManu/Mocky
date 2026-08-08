// VideoExportStore — the file a render produced, kept whole.
//
// A separate store rather than a method on `server/videos/library.js`, and the
// reason is that library's existing callers rather than a preference for new
// files. A `VideoLibrary` entry is a SCROLL SEQUENCE: `list()` promises
// `{ frames, width, fps }`, `GET /api/videos/library` hands that straight to
// `LibraryVideo` in `src/lib/videoLibrary.ts`, and `VideoPlayer.tsx` scrubs
// `/f/1.jpg … /f/<frames>.jpg` from it. Filing an exported film there would put
// rows in that list with no frames to play, a "Recut" button that would run
// ffmpeg over a two-minute movie to cut 150 stills nobody will ever display, and
// a `usage.js` walk that expects a directory. Every one of those functions would
// have had to grow a conditional for a case they were never about — which is the
// definition of making them lie.
//
// What IS copied from the two libraries, because it earned its place:
//   • content addressing — the file is named after the SHA-256 of its bytes, so
//     two people who render byte-identical timelines share one file;
//   • `owners` as a SET rather than a field, for exactly the reason M8 gives:
//     the store deduplicates, so the second person to arrive must not erase the
//     first, and `server/usage.js` splits the footprint between them;
//   • `projects` as a LIST, for the same reason and not a different one. A film
//     used to be reachable only through the job that made it, which the journal
//     forgets after fifty more exports — so the ordinary outcome of the feature
//     was a file on the volume that nothing in the interface could find again.
//     Attaching it to the project it was cut in is what makes the Media tab able
//     to ask for it; a single `project` field would have been wrong for the same
//     reason a single `owner` was, because two projects can arrive at the same
//     bytes and the second must not erase the first;
//   • atomic writes, and an index that is rebuilt rather than trusted;
//   • nothing is ever deleted implicitly. `remove()` is the only thing that
//     unlinks a file.
//
// What is deliberately absent: a poster. Cutting one means ffmpeg, and ffmpeg is
// the one dependency this path does NOT have — `server/videos/` probes for it
// and degrades when it is missing, so an export that needed it would be an
// export that fails on every instance without it. A film the browser can play is
// its own thumbnail.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { quotaError } from '../storage-quota.js'

const HASH_RE = /^[a-f0-9]{64}$/

/**
 * The containers a timeline may ask for, and their extension on disk.
 *
 * A lookup table, not a template: `outputFormat` reaches this module from a
 * document a model wrote, and `${hash}.${format}` would be a caller-controlled
 * string in a filesystem path. The schema already bounds it to this enum
 * (`OUTPUT_FORMATS` in timeline.js) — this map is the second lock, so a schema
 * loosened one day cannot silently become a path.
 */
const CONTAINERS = {
  mp4: { ext: 'mp4', mime: 'video/mp4' },
  webm: { ext: 'webm', mime: 'video/webm' },
}
const FALLBACK = CONTAINERS.mp4

/**
 * `Object.hasOwn`, not `CONTAINERS[name]`.
 *
 * A plain lookup answers for the whole prototype chain, so `format:
 * "constructor"` returns a function, `container.ext` is `undefined`, and the
 * file lands as `<hash>.undefined` — a name no route can ever find again. An own
 * key is the only thing that counts as a container.
 */
function containerFor(name) {
  return typeof name === 'string' && Object.hasOwn(CONTAINERS, name) ? CONTAINERS[name] : FALLBACK
}

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

export class VideoExportStore {
  /**
   * @param {string} dataDir server/data
   * @param {object} [opts]
   * @param {{wouldExceed:(n:number)=>boolean, add:(n:number)=>void, remove:(n:number)=>void, usage:()=>object}} [opts.budget]
   *   The instance-wide disk budget. Optional so a test can build a store
   *   without one, never optional in `server/index.js`: the export directory has
   *   to be one of the directories the ceiling covers, or the ceiling is wrong
   *   by however much has been exported.
   * @param {()=>number} [opts.now]
   */
  constructor(dataDir, opts = {}) {
    this.dir = path.join(dataDir, 'video-exports')
    this.metaFile = path.join(dataDir, 'video-exports.json')
    this.budget = opts.budget || null
    this.now = opts.now || (() => Date.now())
    try {
      fs.mkdirSync(this.dir, { recursive: true })
    } catch {
      /* ignore — surfaced by the first write */
    }
    this.state = this._load()
  }

  _load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.metaFile, 'utf8'))
      return { byHash: parsed?.byHash && typeof parsed.byHash === 'object' ? parsed.byHash : {} }
    } catch {
      // Missing or corrupt: start empty. The files are still on disk and
      // `filePath` finds them without the index — see the note there.
      return { byHash: {} }
    }
  }

  _persist() {
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.metaFile), { recursive: true })
      const tmp = `${this.metaFile}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
      fs.renameSync(tmp, this.metaFile)
    } catch (err) {
      // The film itself is fine — that write throws and fails the job. Only the
      // index is lost, and losing it silently means a restart forgets who owns
      // which export while the bytes stay on disk. Never silent.
      this.lastPersistError = err.message
      console.error(`mocky: could not save the video export index to ${this.metaFile} — ${err.message}`)
    }
  }

  /**
   * Absolute path of one export, or null.
   *
   * The bound is the filesystem, not the index — the same correction
   * `VideoLibrary.framePath` carries, for the same reason: this object's
   * `byHash` is a snapshot taken at construction, so a file restored from a
   * backup, or written by a second process, would be served as a 404 while
   * plainly sitting there.
   *
   * Traversal is closed by construction rather than by filtering: the name is a
   * 64-hex hash this function tested itself, joined to an extension from
   * `CONTAINERS`. Nothing a caller wrote ever reaches the path as text.
   */
  filePath(hash) {
    if (!HASH_RE.test(hash)) return null
    for (const { ext } of Object.values(CONTAINERS)) {
      const fp = path.join(this.dir, `${hash}.${ext}`)
      if (fs.existsSync(fp)) return fp
    }
    return null
  }

  /** The container actually on disk, so a download declares what it sends. */
  mimeFor(hash) {
    const fp = this.filePath(hash)
    if (!fp) return null
    return containerFor(path.extname(fp).slice(1)).mime
  }

  /**
   * A name a browser can save. The full hash is unreadable; twelve is enough.
   *
   * Both halves come from a closed set — HASH_RE for the id, `CONTAINERS` for
   * the extension — so nothing a caller wrote can close the quotes of the
   * `Content-Disposition` header this ends up in.
   */
  downloadName(hash) {
    const fp = this.filePath(hash)
    const ext = fp ? containerFor(path.extname(fp).slice(1)).ext : FALLBACK.ext
    return `mocky-export-${HASH_RE.test(hash) ? hash.slice(0, 12) : 'unknown'}.${ext}`
  }

  meta(hash) {
    return this.state.byHash[hash] || null
  }

  fileSize(hash) {
    const fp = this.filePath(hash)
    if (!fp) return 0
    try {
      return fs.statSync(fp).size
    } catch {
      return 0
    }
  }

  /**
   * Films, newest first.
   *
   * `owner` is the filter the listing route exists for, and it lives here rather
   * than in the route so the answer cannot drift from `ownedBy` next door:
   * `GET /api/video/:hash` refuses a hash the account did not render, and a list
   * that named it anyway would hand back the one thing that check withholds.
   *
   * Unknown options are ignored on purpose — `fileItems()` in server/usage.js
   * calls `list({ includePending: true })` against this store and the image
   * library alike, and the two only keep sharing that reader while an option one
   * of them has never heard of costs nothing.
   *
   * @param {object} [f] { owner, project }
   */
  list(f = {}) {
    let items = Object.values(this.state.byHash)
    if (f.owner) items = items.filter((m) => (m.owners || []).includes(f.owner))
    if (f.project) items = items.filter((m) => (m.projects || []).includes(f.project))
    return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  /** See `owners` in `put`. */
  _addOwner(meta, owner) {
    if (!meta || typeof owner !== 'string' || !owner) return false
    if (!Array.isArray(meta.owners)) meta.owners = []
    if (meta.owners.includes(owner)) return false
    // Bounded: this index is re-serialised whole on every write.
    if (meta.owners.length >= 20) return false
    meta.owners.push(owner)
    return true
  }

  /**
   * Record that this film was cut from `project`.
   *
   * Sliced and bounded exactly as `ImageLibrary` slices `project` and bounds
   * `owners`: the string arrives from a request body and lands in an index that
   * is re-serialised whole on every write, so an unbounded one is both a storage
   * hole and a growing pause on the event loop.
   *
   * Absent on everything rendered before this field existed. Those films are
   * listed under no project rather than guessed into one — the honesty
   * corollary M8 states about unowned images, applied to the same shape.
   *
   * @returns {boolean} whether the list changed, so the caller can persist once
   */
  _addProject(meta, project) {
    if (!meta || typeof project !== 'string' || !project) return false
    if (!Array.isArray(meta.projects)) meta.projects = []
    const id = project.slice(0, 100)
    if (meta.projects.includes(id)) return false
    if (meta.projects.length >= 20) return false
    meta.projects.push(id)
    return true
  }

  /**
   * Did this account render these bytes?
   *
   * The durable half of the download check. The queue's journal keeps only the
   * newest MAX_JOURNAL_JOBS finished jobs, so the job that carries this hash is
   * gone after fifty more exports — while the file, which nothing prunes, is
   * still there. Authorising on the job alone would therefore take a user's own
   * export away from them on their fifty-first.
   */
  ownedBy(hash, userId) {
    if (!userId) return false
    const meta = this.state.byHash[hash]
    return Array.isArray(meta?.owners) && meta.owners.includes(userId)
  }

  /**
   * Store one rendered file, whole.
   *
   * No cutting, no re-encoding, no second pass: what the worker produced is what
   * lands on disk, byte for byte, which is also what makes the hash meaningful.
   *
   * @param {Buffer} buffer  the bytes the render worker returned
   * @param {object} spec    { owner, project, format, aspectRatio, scenes, durationMs }
   * @returns {{hash:string, meta:object, fromCache:boolean}}
   */
  put(buffer, spec = {}) {
    if (!buffer || !buffer.length) throw new Error('The render produced an empty file.')
    const hash = sha256hex(buffer)

    // Already here: two people rendering the same timeline from the same images
    // is the ordinary case for a shared instance, and re-writing identical bytes
    // would charge the budget twice for one file. Both are recorded as owners,
    // and both projects on the entry — the second arrival adds, it never
    // replaces.
    const known = this.state.byHash[hash]
    if (known && this.filePath(hash)) {
      // Both called, never short-circuited: `||` would skip the project the
      // moment the owner was already known, which is exactly the case a second
      // export of the same film from a second project produces.
      const gainedOwner = this._addOwner(known, spec.owner)
      const gainedProject = this._addProject(known, spec.project)
      if (gainedOwner || gainedProject) this._persist()
      return { hash, meta: known, fromCache: true }
    }

    /*
     * Refuse BEFORE writing.
     *
     * Every store in this repository swallows its own persistence errors, so a
     * volume that is already full does not announce itself: the write fails, the
     * catch logs, and the API answers as though the export succeeded. The honest
     * place to stop is the one place that still knows how many bytes are about
     * to be spent. `code` is what the route reads to answer 507 rather than 500.
     */
    if (this.budget?.wouldExceed(buffer.length)) {
      const err = new Error(quotaError(this.budget.usage()))
      err.code = 'QUOTA'
      throw err
    }

    const container = containerFor(spec.format)
    const file = path.join(this.dir, `${hash}.${container.ext}`)
    fs.mkdirSync(this.dir, { recursive: true })
    // Temp + rename, in the same directory so the rename is atomic: a crash
    // halfway through an 80 MB write would otherwise leave a truncated file
    // under a hash that promises its own contents, and `filePath` would serve it
    // for ever after.
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    try {
      fs.writeFileSync(tmp, buffer)
      fs.renameSync(tmp, file)
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true })
      } catch {
        /* best effort */
      }
      throw err
    }
    this.budget?.add?.(buffer.length)

    const meta = {
      hash,
      bytes: buffer.length,
      container: container.ext,
      mime: container.mime,
      // The timeline is NOT copied in. It carries the overlay text somebody
      // wrote, and this index is read by the admin usage report; what a report
      // needs is the shape of the render, not its contents.
      scenes: Number.isFinite(spec.scenes) ? spec.scenes : 0,
      durationMs: Number.isFinite(spec.durationMs) ? spec.durationMs : 0,
      aspectRatio: typeof spec.aspectRatio === 'string' ? spec.aspectRatio : '',
      owners: [],
      projects: [],
      createdAt: this.now(),
    }
    this._addOwner(meta, spec.owner)
    this._addProject(meta, spec.project)
    this.state.byHash[hash] = meta
    this._persist()
    return { hash, meta, fromCache: false }
  }

  /**
   * Explicit removal — the only thing that deletes a file.
   *
   * Nothing prunes exports on a timer, and that is the deliberate half: a job's
   * `videoHash` is a link a user may follow days later, and a store that expired
   * its own contents would turn that into a download button leading nowhere. The
   * budget is what bounds the directory instead, by refusing the next render
   * with a message that says what to delete.
   */
  remove(hash) {
    const meta = this.state.byHash[hash]
    const fp = this.filePath(hash)
    if (!meta && !fp) return null
    // Measured before the unlink, not taken from the metadata: an entry written
    // by an older version, or a file replaced underneath, would otherwise give
    // the budget back a number that was never on the disk.
    const bytes = this.fileSize(hash)
    if (fp) {
      try {
        fs.rmSync(fp, { force: true })
        this.budget?.remove?.(bytes)
      } catch {
        /* metadata is dropped either way */
      }
    }
    delete this.state.byHash[hash]
    this._persist()
    return { removed: true, meta: meta || null }
  }
}
