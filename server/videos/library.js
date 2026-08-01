// VideoLibrary — generated clips and the scroll sequences cut from them.
//
// Deliberately a sibling of ImageLibrary rather than a branch inside it: a
// video is not one file but a directory (the source clip, a poster, and up to
// 150 frames), and every method that library exposes — zip, favourites, the
// single-file `/:hash` route — assumes one file per hash. Mixing the two would
// have meant a conditional in each of them.
//
// What IS copied from it, because it earned its place:
//   • content addressing — the directory is named after the SHA-256 of the clip,
//     so the same bytes are never stored twice;
//   • a request cache — an identical (provider|model|prompt|seconds) request
//     reuses the sequence instead of paying for a second generation. Video is
//     the most expensive thing Mocky can ask a provider for, by an order of
//     magnitude; this is the difference between iterating on a screen and
//     watching a bill.
//   • deleting a project never deletes a sequence. Only an explicit removal does.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { extractFrames, frameName } from './frames.js'

const HASH_RE = /^[a-f0-9]{64}$/

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

export class VideoLibrary {
  /**
   * @param {string} dataDir server/data
   * @param {object} [opts]
   * @param {()=>number} [opts.now]
   * @param {Function} [opts.extract] injected frame extractor (tests)
   */
  constructor(dataDir, opts = {}) {
    this.rootDir = path.join(dataDir, 'video-library')
    this.metaFile = path.join(dataDir, 'video-library.json')
    this.now = opts.now || (() => Date.now())
    this.extract = opts.extract || extractFrames
    try {
      fs.mkdirSync(this.rootDir, { recursive: true })
    } catch {
      /* ignore — surfaced by the first write */
    }
    this.state = this._load()
  }

  _load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.metaFile, 'utf8'))
      return {
        byHash: parsed?.byHash && typeof parsed.byHash === 'object' ? parsed.byHash : {},
        byRequest: parsed?.byRequest && typeof parsed.byRequest === 'object' ? parsed.byRequest : {},
      }
    } catch {
      return { byHash: {}, byRequest: {} }
    }
  }

  _persist() {
    try {
      fs.mkdirSync(path.dirname(this.metaFile), { recursive: true })
      const tmp = `${this.metaFile}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
      fs.renameSync(tmp, this.metaFile)
    } catch {
      /* in-memory copy stays valid */
    }
  }

  /** Cache key for "the same generation, asked twice". */
  static requestKey(spec) {
    return [
      spec.provider || '',
      spec.model || '',
      String(spec.prompt || '').trim(),
      String(spec.negative || '').trim(),
      spec.seconds || '',
    ].join('|')
  }

  dirFor(hash) {
    return HASH_RE.test(hash) ? path.join(this.rootDir, hash) : null
  }

  meta(hash) {
    return this.state.byHash[hash] || null
  }

  /**
   * Absolute path of one frame, or null.
   *
   * The bound is the filesystem, not the metadata. Consulting `byHash` first
   * looked tidier and was wrong twice over: this object's in-memory state is a
   * snapshot taken at construction, so a sequence written by anything other
   * than this process — a restore, a second worker, a seed script — served 404s
   * for files that were plainly there; and it made every frame request depend
   * on a lookup that answers a question the `existsSync` below already answers.
   *
   * Traversal is closed by construction rather than by filtering: the index is
   * parsed as an integer and re-formatted by `frameName`, so nothing the caller
   * writes ever reaches the path as text.
   */
  framePath(hash, index) {
    const dir = this.dirFor(hash)
    if (!dir) return null
    const i = Number(index)
    // 9999 is the ceiling of the 4-digit name format, not a policy.
    if (!Number.isInteger(i) || i < 1 || i > 9999) return null
    const fp = path.join(dir, frameName(i))
    return fs.existsSync(fp) ? fp : null
  }

  posterPath(hash) {
    const dir = this.dirFor(hash)
    if (!dir) return null
    const fp = path.join(dir, 'poster.jpg')
    return fs.existsSync(fp) ? fp : null
  }

  sourcePath(hash) {
    const dir = this.dirFor(hash)
    if (!dir) return null
    const fp = path.join(dir, 'source.mp4')
    return fs.existsSync(fp) ? fp : null
  }

  list({ project } = {}) {
    return Object.values(this.state.byHash)
      .filter((m) => !project || m.project === project)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  /**
   * Store a clip and cut it into a sequence.
   *
   * @param {Buffer} buffer  the clip as downloaded from the provider
   * @param {object} spec    { prompt, negative?, seconds?, provider, model, project?, slot? }
   * @param {object} [opts]  { fps, width, max }
   */
  async ingest(buffer, spec = {}, opts = {}) {
    if (!buffer || !buffer.length) throw new Error('empty video')
    const hash = sha256hex(buffer)
    const dir = path.join(this.rootDir, hash)
    const key = VideoLibrary.requestKey(spec)

    // Already cut: reuse it, and still record the request so the next identical
    // ask skips the provider too.
    const known = this.state.byHash[hash]
    if (known && this.posterPath(hash)) {
      if (this.state.byRequest[key] !== hash) {
        this.state.byRequest[key] = hash
        this._persist()
      }
      return { hash, meta: known, fromCache: true }
    }

    fs.mkdirSync(dir, { recursive: true })
    const source = path.join(dir, 'source.mp4')
    fs.writeFileSync(source, buffer)

    let cut
    try {
      cut = await this.extract(source, dir, opts)
    } catch (err) {
      // A half-written directory would be found by `posterPath` on the next run
      // and served as a working sequence with no frames in it.
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
      throw err
    }

    const meta = {
      hash,
      frames: cut.frames,
      width: cut.width,
      fps: cut.fps,
      bytes: buffer.length,
      prompt: String(spec.prompt || '').slice(0, 500),
      negative: String(spec.negative || '').slice(0, 300),
      provider: spec.provider || '',
      model: spec.model || '',
      project: spec.project || '',
      slot: spec.slot || 'hero',
      createdAt: this.now(),
    }
    this.state.byHash[hash] = meta
    this.state.byRequest[key] = hash
    this._persist()
    return { hash, meta, fromCache: false }
  }

  /** The sequence a previous identical request produced, if it still exists. */
  cached(spec) {
    const hash = this.state.byRequest[VideoLibrary.requestKey(spec)]
    if (!hash) return null
    const meta = this.state.byHash[hash]
    if (!meta || !this.posterPath(hash)) return null
    return { hash, meta, fromCache: true }
  }

  /** Explicit removal — the only thing that deletes files. */
  remove(hash) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    const dir = this.dirFor(hash)
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        /* metadata is dropped either way */
      }
    }
    delete this.state.byHash[hash]
    for (const [k, v] of Object.entries(this.state.byRequest)) {
      if (v === hash) delete this.state.byRequest[k]
    }
    this._persist()
    return { removed: true, meta }
  }
}
