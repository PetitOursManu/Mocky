// ImageLibrary — the single source of truth for generated images (M8):
//   • global & project-independent
//   • files at data/image-library/{contentHash}.jpg, dedup by content hash
//   • metadata at data/image-library.json
//   • identical request (provider|prompt|negative|seed|WxH) reuses the cached
//     image instead of calling the provider again (free rate-limit savings)
//   • deleting a project NEVER deletes a library file — only explicit removal does
//
// No database, no native deps — a JSON file + image files, atomic writes.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { makeZip } from './zip.js'

const HASH_RE = /^[a-f0-9]{16,64}$/

function slugify(s, fallback) {
  const out = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return out || fallback
}

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

export class ImageLibrary {
  /**
   * @param {string} dataDir  server/data
   * @param {object} [opts]
   * @param {import('./queue.js').SpacedQueue} [opts.queue]  paces provider calls
   * @param {()=>number} [opts.now]
   */
  constructor(dataDir, opts = {}) {
    this.filesDir = path.join(dataDir, 'image-library')
    this.metaFile = path.join(dataDir, 'image-library.json')
    this.queue = opts.queue || { add: (fn) => fn() }
    this.now = opts.now || (() => Date.now())
    try {
      fs.mkdirSync(this.filesDir, { recursive: true })
    } catch {
      /* ignore */
    }
    this.state = this._load() // { byHash: {hash: LibraryImage}, byRequest: {reqKey: hash} }
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
      /* in-memory still valid */
    }
  }

  // --- request identity (prompt+seed dedup) ---
  static requestKey(spec) {
    const s = `${spec.provider}|${spec.prompt}|${spec.negative || ''}|${spec.seed ?? ''}|${spec.width}x${spec.height}`
    return sha256hex(Buffer.from(s, 'utf8')).slice(0, 32)
  }

  filePath(hash) {
    if (!HASH_RE.test(hash)) return null
    return path.join(this.filesDir, `${hash}.jpg`)
  }

  fileExists(hash) {
    const fp = this.filePath(hash)
    return !!fp && fs.existsSync(fp)
  }

  get(hash) {
    return this.state.byHash[hash] || null
  }

  /**
   * Generate (or reuse) an image for a spec.
   * @param {object} spec  { prompt, negative?, seed?, width?, height?, tags?, project?, slotType?, providerId? }
   * @param {object} deps  { registry, onNotice? }
   * @returns {Promise<{hash:string|null, fromCache:boolean, skipped?:boolean, meta?:object}>}
   */
  async generate(spec, deps = {}) {
    const registry = deps.registry
    const onNotice = deps.onNotice || (() => {})
    const width = Number(spec.width) || 1024
    const height = Number(spec.height) || 1024
    if (!spec.prompt || !String(spec.prompt).trim()) {
      throw new Error('A prompt is required to generate an image')
    }
    const provider = spec.providerId ? registry.get(spec.providerId) : await registry.pick()
    if (!provider) throw new Error('No image provider available')

    const reqKey = ImageLibrary.requestKey({
      provider: provider.id,
      prompt: spec.prompt,
      negative: spec.negative,
      seed: spec.seed,
      width,
      height,
    })

    // Reuse an identical prior request (M8) — no provider call.
    const cachedHash = this.state.byRequest[reqKey]
    if (cachedHash && this.fileExists(cachedHash)) {
      const meta = this._attachProject(cachedHash, spec.project)
      return { hash: cachedHash, fromCache: true, meta }
    }

    // Generate through the paced queue (runs in parallel with other work).
    const result = await this.queue.add(() =>
      provider.generate({ prompt: spec.prompt, negative: spec.negative, seed: spec.seed, width, height }),
    )
    if (!result || result.skipped) {
      onNotice(`Muse: image provider "${provider.id}" produced no image — using placeholder`)
      return { hash: null, fromCache: false, skipped: true }
    }

    const buffer = result.buffer
    const contentHash = sha256hex(buffer)
    const fp = path.join(this.filesDir, `${contentHash}.jpg`)
    if (!fs.existsSync(fp)) {
      try {
        fs.mkdirSync(this.filesDir, { recursive: true })
        fs.writeFileSync(fp, buffer)
      } catch (err) {
        throw new Error(`Failed to store image: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const tags = Array.from(
      new Set([...(Array.isArray(spec.tags) ? spec.tags : []), spec.slotType].filter(Boolean).map(String)),
    )
    const existing = this.state.byHash[contentHash]
    const meta = existing || {
      hash: contentHash,
      prompt: spec.prompt,
      negative: spec.negative || null,
      provider: provider.id,
      seed: spec.seed ?? null,
      width,
      height,
      createdAt: this.now(),
      tags: [],
      projects: [],
      favorite: false,
    }
    meta.tags = Array.from(new Set([...(meta.tags || []), ...tags]))
    if (spec.project && !meta.projects.includes(spec.project)) meta.projects.push(spec.project)
    this.state.byHash[contentHash] = meta
    this.state.byRequest[reqKey] = contentHash
    this._persist()
    return { hash: contentHash, fromCache: false, meta }
  }

  /**
   * Store bytes the USER supplied rather than bytes a provider produced.
   *
   * Same store, same content addressing, same dedup — an upload that matches an
   * existing image simply attaches to it. What differs is that there is no
   * request key: nothing was asked of a provider, so nothing can be "reused
   * instead of regenerating". `provider` is recorded as 'upload', which is what
   * the library badge shows and what tells the two apart afterwards.
   *
   * Dimensions come from the caller. The browser has already decoded the file
   * to show a preview and knows them exactly; parsing three image formats
   * server-side to learn what the client could simply say would be work in
   * exchange for nothing.
   */
  ingestUpload(buffer, spec = {}) {
    if (!buffer || !buffer.length) throw new Error('empty file')
    const contentHash = sha256hex(buffer)
    const fp = path.join(this.filesDir, `${contentHash}.jpg`)
    if (!fs.existsSync(fp)) {
      fs.mkdirSync(this.filesDir, { recursive: true })
      fs.writeFileSync(fp, buffer)
    }
    const tags = Array.from(new Set(['upload', ...(Array.isArray(spec.tags) ? spec.tags : [])].map(String)))
    const existing = this.state.byHash[contentHash]
    const meta = existing || {
      hash: contentHash,
      // The library shows `prompt` as the caption everywhere; for an upload the
      // file's own name is the closest honest thing to put there.
      prompt: String(spec.name || 'image importée').slice(0, 200),
      negative: null,
      provider: 'upload',
      seed: null,
      width: Number(spec.width) || 0,
      height: Number(spec.height) || 0,
      // The bytes are whatever was uploaded; the .jpg on disk is a naming
      // convention, not a claim about the format. This is what the route serves.
      mime: typeof spec.mime === 'string' ? spec.mime : 'image/jpeg',
      createdAt: this.now(),
      tags: [],
      projects: [],
      favorite: false,
    }
    meta.tags = Array.from(new Set([...(meta.tags || []), ...tags]))
    if (spec.project && !meta.projects.includes(spec.project)) meta.projects.push(spec.project)
    this.state.byHash[contentHash] = meta
    this._persist()
    return { hash: contentHash, meta, fromCache: Boolean(existing) }
  }

  _attachProject(hash, project) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    if (project && !meta.projects.includes(project)) {
      meta.projects.push(project)
      this._persist()
    }
    return meta
  }

  /** Toggle favorite; returns the updated metadata (or null if unknown). */
  toggleFavorite(hash) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    meta.favorite = !meta.favorite
    this._persist()
    return meta
  }

  /**
   * Filtered listing (newest first).
   * @param {object} [f] { query, project, favorites, slotType }
   */
  list(f = {}) {
    const q = (f.query || '').toLowerCase().trim()
    let items = Object.values(this.state.byHash)
    if (q) {
      items = items.filter(
        (m) => m.prompt.toLowerCase().includes(q) || (m.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
    }
    if (f.project) items = items.filter((m) => (m.projects || []).includes(f.project))
    if (f.favorites) items = items.filter((m) => m.favorite)
    if (f.slotType) items = items.filter((m) => (m.tags || []).includes(f.slotType))
    return items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  /**
   * Explicitly remove an image (the ONLY thing that deletes a file, M8).
   * @returns {{removed:boolean, projects:string[]}|null}
   */
  remove(hash) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    const fp = this.filePath(hash)
    if (fp) {
      try {
        fs.rmSync(fp, { force: true })
      } catch {
        /* ignore */
      }
    }
    delete this.state.byHash[hash]
    for (const [k, h] of Object.entries(this.state.byRequest)) {
      if (h === hash) delete this.state.byRequest[k]
    }
    this._persist()
    return { removed: true, projects: meta.projects || [] }
  }

  /**
   * A project was deleted: drop it from every image's usage list, but NEVER
   * delete a file (M8). Returns how many images were touched.
   */
  onProjectDeleted(project) {
    let touched = 0
    for (const meta of Object.values(this.state.byHash)) {
      const i = (meta.projects || []).indexOf(project)
      if (i >= 0) {
        meta.projects.splice(i, 1)
        touched++
      }
    }
    if (touched) this._persist()
    return touched
  }

  /** Friendly download filename for an image. */
  filenameFor(hash) {
    const meta = this.state.byHash[hash]
    const label = meta ? slugify(meta.tags?.[0] || meta.prompt, 'image') : 'image'
    // Uploads keep their real format; only the on-disk name is always .jpg.
    const ext = /png/i.test(meta?.mime || '') ? 'png' : /webp/i.test(meta?.mime || '') ? 'webp' : 'jpg'
    return `${label}-${hash.slice(0, 8)}.${ext}`
  }

  /** What the bytes actually are — generated images are always JPEG. */
  mimeFor(hash) {
    return this.state.byHash[hash]?.mime || 'image/jpeg'
  }

  /**
   * Build a ZIP of the given hashes (or all), with a manifest.json carrying
   * prompts/seeds/tags so users can re-generate or audit later (prompt §4.3).
   * @returns {Buffer}
   */
  zip(hashes) {
    const list = (hashes && hashes.length ? hashes : Object.keys(this.state.byHash)).filter((h) =>
      this.fileExists(h),
    )
    const entries = []
    const manifest = { generatedBy: 'Mocky Muse', createdAt: new Date().toISOString(), images: [] }
    for (const hash of list) {
      const meta = this.state.byHash[hash]
      const filename = this.filenameFor(hash)
      const fp = this.filePath(hash)
      try {
        entries.push({ name: filename, data: fs.readFileSync(fp) })
      } catch {
        continue
      }
      manifest.images.push({
        filename,
        hash,
        prompt: meta.prompt,
        negative: meta.negative,
        provider: meta.provider,
        seed: meta.seed,
        width: meta.width,
        height: meta.height,
        tags: meta.tags,
      })
    }
    entries.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) })
    return makeZip(entries)
  }
}
