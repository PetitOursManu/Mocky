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
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.metaFile), { recursive: true })
      const tmp = `${this.metaFile}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
      fs.renameSync(tmp, this.metaFile)
    } catch (err) {
      // In-memory stays valid, but this failing silently is how a library goes
      // missing: the .jpg files write fine (that error does surface), only the
      // index fails — so after a restart the library is empty and every file on
      // disk is an orphan nothing can find again.
      this.lastPersistError = err.message
      console.error(`mocky: could not save the image index to ${this.metaFile} — ${err.message}`)
    }
  }

  // --- request identity (prompt+seed dedup) ---
  /**
   * What makes two generation requests "the same one".
   *
   * The source image and the strength join the key ONLY when there is a source
   * image, and that asymmetry is load-bearing twice over. They have to be in
   * there at all because a prompt no longer identifies a derivation: two
   * variants of two different pictures share a prompt, a seed and a size, so
   * without the source in the key the second one is served the first one's bytes
   * — a picture of somebody else's photograph, reported as a cache hit. And they
   * have to stay out of it otherwise, because appending two empty fields
   * unconditionally changes every key ever written and makes the first boot
   * after this change re-pay a provider for a library it already has.
   */
  static requestKey(spec) {
    const s = `${spec.provider}|${spec.prompt}|${spec.negative || ''}|${spec.seed ?? ''}|${spec.width}x${spec.height}`
    const derived = spec.initHash ? `|init:${spec.initHash}|strength:${spec.strength ?? ''}` : ''
    return sha256hex(Buffer.from(s + derived, 'utf8')).slice(0, 32)
  }

  filePath(hash) {
    if (!HASH_RE.test(hash)) return null
    return path.join(this.filesDir, `${hash}.jpg`)
  }

  /** Bytes this image occupies, or 0 if it is not on disk. For the disk budget. */
  fileSize(hash) {
    const fp = this.filePath(hash)
    if (!fp) return 0
    try {
      return fs.statSync(fp).size
    } catch {
      return 0
    }
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
   * @param {object} spec  { prompt, negative?, seed?, width?, height?, tags?, project?, slotType?, providerId?, init?, strength?, pending? }
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

    // The source image, when this is a derivation rather than a generation. Its
    // content hash is also its id in this very library (M8), so hashing the
    // bytes we are about to send identifies the request without having to trust
    // the caller about which image it claims to be deriving.
    const init = spec.init && Buffer.isBuffer(spec.init.buffer) && spec.init.buffer.length ? spec.init : null
    const initHash = init ? sha256hex(init.buffer) : null

    const reqKey = ImageLibrary.requestKey({
      provider: provider.id,
      prompt: spec.prompt,
      negative: spec.negative,
      seed: spec.seed,
      width,
      height,
      initHash,
      strength: init ? spec.strength : null,
    })

    // Reuse an identical prior request (M8) — no provider call.
    const cachedHash = this.state.byRequest[reqKey]
    if (cachedHash && this.fileExists(cachedHash)) {
      const meta = this._attachProject(cachedHash, spec.project, spec.owner)
      return { hash: cachedHash, fromCache: true, meta }
    }

    // Generate through the paced queue (runs in parallel with other work).
    //
    // The cache is re-checked INSIDE the task. Checking only before queueing
    // meant two identical requests in flight at once — a double click, a client
    // retry, two screens sharing a hero prompt — both sailed past the test and
    // both paid the provider, which is precisely what the dedupe exists to stop.
    const result = await this.queue.add(() => {
      const raced = this.state.byRequest[reqKey]
      if (raced && this.fileExists(raced)) return { reusedHash: raced }
      return provider.generate({
        prompt: spec.prompt,
        negative: spec.negative,
        seed: spec.seed,
        width,
        height,
        // Only on a derivation. Every provider reads `init` through readInit(),
        // which treats absent and null alike, so passing the pair always would
        // work — but it would also put an image-to-image request on the wire for
        // every ordinary generation, where the honest answer from an incapable
        // provider is now a refusal.
        ...(init ? { init, strength: spec.strength } : {}),
      })
    })
    if (result && result.reusedHash) {
      const meta = this._attachProject(result.reusedHash, spec.project, spec.owner)
      return { hash: result.reusedHash, fromCache: true, meta }
    }
    if (!result || result.skipped) {
      onNotice(`Muse: image provider "${provider.id}" produced no image — using placeholder`)
      return { hash: null, fromCache: false, skipped: true }
    }

    // A derivation that comes back without `edited` is not a derivation.
    //
    // `refuseInit()` already makes an incapable provider throw, but that guard
    // lives inside the providers Mocky ships and a custom base URL can put
    // something else behind one. This is the same rule on the storage side,
    // where nothing can route around it: the flag is the only thing that tells a
    // real image-to-image result apart from a picture drawn from the prompt
    // alone, and once bytes are in the library nothing can ever tell them apart
    // again.
    if (init && !result.edited) {
      throw new Error(
        `Le fournisseur « ${provider.id} » a rendu une image sans confirmer qu'elle dérive de la source. Mocky ne l'enregistre pas : elle serait présentée comme une variante de votre image alors que rien ne le garantit.`,
      )
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

    // Bounded, the way the video library already bounds its own metadata. These
    // strings come straight from the request body and land in an index that is
    // re-serialised whole on every write, so an unbounded one is both a storage
    // hole and a growing pause on the event loop.
    const tags = Array.from(
      new Set([...(Array.isArray(spec.tags) ? spec.tags : []), spec.slotType].filter(Boolean).map(String)),
    )
      .slice(0, 10)
      .map((t) => t.slice(0, 40))
    const existing = this.state.byHash[contentHash]
    const meta = existing || {
      hash: contentHash,
      prompt: String(spec.prompt || '').slice(0, 500),
      negative: spec.negative ? String(spec.negative).slice(0, 300) : null,
      provider: provider.id,
      seed: spec.seed ?? null,
      width,
      height,
      // The format the provider actually returned. Dropping it meant a PNG from
      // OpenAI or sd-webui was served as image/jpeg — under nosniff — and
      // exported named .jpg, which several tools then refuse to open.
      mime: result.contentType || 'image/jpeg',
      createdAt: this.now(),
      tags: [],
      projects: [],
      owners: [],
      favorite: false,
      // Which image in this same library these bytes were derived from, or null
      // on the ordinary path — a field that is always present reads as an
      // answer, where an absent one reads as "nobody looked".
      derivedFrom: initHash,
    }
    meta.tags = Array.from(new Set([...(meta.tags || []), ...tags])).slice(0, 20)
    const project = spec.project ? String(spec.project).slice(0, 100) : null
    if (project && !meta.projects.includes(project)) meta.projects.push(project)
    // `pending` on a NEW entry only, and that is not a detail. The store is
    // content-addressed, so an image whose bytes match one already here lands on
    // THAT entry's metadata — marking it would pull a picture the user accepted
    // weeks ago out of their own library because of a duplicate they never saw.
    if (!existing && spec.pending) meta.pending = true
    this._addOwner(meta, spec.owner)
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
      owners: [],
      favorite: false,
    }
    meta.tags = Array.from(new Set([...(meta.tags || []), ...tags]))
    if (spec.project && !meta.projects.includes(spec.project)) meta.projects.push(spec.project)
    this._addOwner(meta, spec.owner)
    this.state.byHash[contentHash] = meta
    this._persist()
    return { hash: contentHash, meta, fromCache: Boolean(existing) }
  }

  /**
   * Record that `owner` put this image here.
   *
   * A set rather than a field, because the library is content-addressed: two
   * people who generate or upload byte-identical images land on the SAME entry,
   * and the second arrival must not erase the first. `server/usage.js` splits
   * the file's bytes between whoever is in this list, so the admin table adds
   * up to what the volume actually holds.
   *
   * Absent on everything that existed before this was recorded. That is
   * reported as unattributed rather than backfilled — an owner inferred from
   * timestamps would be a guess printed as a fact.
   *
   * @returns {boolean} whether the list changed, so the caller can persist once
   */
  _addOwner(meta, owner) {
    if (!meta || typeof owner !== 'string' || !owner) return false
    if (!Array.isArray(meta.owners)) meta.owners = []
    if (meta.owners.includes(owner)) return false
    // Bounded like `tags` and `projects` beside it: this index is re-serialised
    // whole on every write, so nothing in it may grow without a ceiling.
    if (meta.owners.length >= 20) return false
    meta.owners.push(owner)
    return true
  }

  _attachProject(hash, project, owner) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    let changed = this._addOwner(meta, owner)
    if (project && !meta.projects.includes(project)) {
      meta.projects.push(project)
      changed = true
    }
    if (changed) this._persist()
    return meta
  }

  /**
   * --- `pending`, and why the flag is that way round ---
   *
   * The obvious spelling is `confirmed: boolean`, defaulting to false. It is
   * wrong here, and the reason is the upgrade rather than the code: this library
   * already holds every image on the instance, none of them carries the field,
   * and `confirmed !== true` would make the whole of it ineligible the moment
   * this version boots. Video export works today; it would stop working on
   * update, for everybody, with no failing test to show for it — the flag would
   * be doing exactly what it was written to do, to a corpus it was never about.
   *
   * So the flag marks the exception instead of the rule. `pending: true` is set
   * in ONE place — the multi-step flow, on images the user has not laid eyes on
   * yet — and its ABSENCE means eligible. Every image that predates this field
   * is therefore already correct, and the migration is not a migration: there is
   * nothing to backfill, and nothing that can be forgotten.
   *
   * `confirm()` deletes the key rather than setting it false, for the same
   * reason: a confirmed image and one from before the feature must be
   * indistinguishable, or "eligible" quietly becomes two different questions.
   */

  /**
   * The user has seen this image and kept it.
   *
   * One-way, deliberately. There is no un-confirm and no `pending: true` from
   * outside the variant flow, because the flag's whole meaning is "nobody has
   * looked at this yet" — a fact about the past that a later call cannot make
   * untrue. A route that could re-arm it would let one account hide an image
   * another account has already built a film out of.
   *
   * Idempotent: confirming twice is the same answer, which matters because the
   * panel confirms a batch and a retry after a dropped response must not 404.
   *
   * @returns {object|null} the metadata, or null when the hash is unknown
   */
  confirm(hash) {
    const meta = this.state.byHash[hash]
    if (!meta) return null
    if (!meta.pending) return meta
    delete meta.pending
    this._persist()
    return meta
  }

  /**
   * Which of these hashes are still awaiting a human. The guard's single source.
   *
   * Here rather than in each route, because /api/video/render and
   * /api/video/compose both have to refuse the same set, and two callers reading
   * `get(id)?.pending` for themselves is how they end up disagreeing — one of
   * them skipping the unknown hash, the other counting it.
   *
   * An id that is not in the library at all is NOT reported here. It is a
   * different fault with a different answer (404, "these images are gone"), and
   * both routes check for it first.
   */
  pendingAmong(hashes) {
    return [...new Set(hashes || [])].filter((h) => this.state.byHash[h]?.pending === true)
  }

  /**
   * Did this account put this image here? Mirrors `VideoExportStore.ownedBy`.
   *
   * `owners` is a set because the library is content-addressed (M8), so this is
   * membership rather than equality. Images that predate the field have an empty
   * set and therefore belong to nobody: that is the honest answer, and it means
   * nobody can confirm them — they were never pending either, so there is
   * nothing to confirm.
   */
  ownedBy(hash, userId) {
    if (!userId) return false
    const meta = this.state.byHash[hash]
    return Array.isArray(meta?.owners) && meta.owners.includes(userId)
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
   *
   * `includePending` is off by default because an image awaiting confirmation is
   * not a library image yet: a batch of variants would otherwise land in the
   * Media tab, in "Download all", and in the picker the moment it was generated,
   * which is the whole thing a confirmation step is there to prevent. The flag
   * exists so the panel that DOES the confirming can see them.
   *
   * @param {object} [f] { query, project, favorites, slotType, includePending }
   */
  list(f = {}) {
    const q = (f.query || '').toLowerCase().trim()
    let items = Object.values(this.state.byHash)
    if (!f.includePending) items = items.filter((m) => !m.pending)
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
